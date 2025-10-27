package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gorilla/mux"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
	gomail "gopkg.in/mail.v2"
)

// global Variables
var DB *sql.DB

// Rate limiter for password attempts
type RateLimiter struct {
	attempts map[string][]time.Time
	mu       sync.Mutex
}

var limiter = &RateLimiter{
	attempts: make(map[string][]time.Time),
}

func (rl *RateLimiter) Allow(key string, maxAttempts int, window time.Duration) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()

	// Clean old attempts
	validAttempts := []time.Time{}
	for _, t := range rl.attempts[key] {
		if now.Sub(t) < window {
			validAttempts = append(validAttempts, t)
		}
	}

	if len(validAttempts) >= maxAttempts {
		return false
	}

	validAttempts = append(validAttempts, now)
	rl.attempts[key] = validAttempts

	return true
}

// Token storage (in-memory, expires after use or time)
type DownloadToken struct {
	FileID    string
	ExpiresAt time.Time
}

type TokenStore struct {
	tokens map[string]DownloadToken
	mu     sync.RWMutex
}

var tokenStore = &TokenStore{
	tokens: make(map[string]DownloadToken),
}

func (ts *TokenStore) Generate(fileID string, duration time.Duration) string {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	// Generate random token
	b := make([]byte, 32)
	rand.Read(b)
	token := base64.URLEncoding.EncodeToString(b)

	ts.tokens[token] = DownloadToken{
		FileID:    fileID,
		ExpiresAt: time.Now().Add(duration),
	}

	return token
}

func (ts *TokenStore) Validate(token string) (string, bool) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	dt, exists := ts.tokens[token]
	if !exists {
		return "", false
	}

	// Check if expired
	if time.Now().After(dt.ExpiresAt) {
		delete(ts.tokens, token)
		return "", false
	}

	// Token is valid - delete it (single use)
	delete(ts.tokens, token)
	return dt.FileID, true
}

func (ts *TokenStore) Cleanup() {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	now := time.Now()
	for token, dt := range ts.tokens {
		if now.After(dt.ExpiresAt) {
			delete(ts.tokens, token)
		}
	}
}

// JSON request/response structs
type PasswordRequest struct {
	Password string `json:"password"`
}

type FileInfoResponse struct {
	Filename         string `json:"filename"`
	RequiresPassword bool   `json:"requires_password"`
	FileSize         int64  `json:"file_size,omitempty"`
	ExpiresAt        string `json:"expires_at,omitempty"`
}

type VerifyResponse struct {
	Message       string `json:"message"`
	DownloadToken string `json:"download_token"`
	ExpiresIn     int    `json:"expires_in"` // seconds
}

type DownloadRequest struct {
	Token string `json:"token"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func main() {
	// init the Database
	initDB()
	defer DB.Close()

	// Start cleanup routine for expired tokens
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		for range ticker.C {
			tokenStore.Cleanup()
		}
	}()

	router := mux.NewRouter()

	// Upload endpoint (multipart form data)
	router.HandleFunc("/upload", uploadFile).Methods("POST")

	// Check file info (no auth needed)
	router.HandleFunc("/upload/{id}/info", getFileInfo).Methods("GET")

	// Verify password and get download token
	router.HandleFunc("/upload/{id}/verify", verifyPassword).Methods("POST")

	// Download file with token
	router.HandleFunc("/upload/{id}/download", downloadFile).Methods("POST")

	fmt.Println("Starting server on port 3000")
	if err := http.ListenAndServe(":3000", router); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}

// Get file info without authentication
func getFileInfo(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var filename string
	var password string
	var expiresIn sql.NullInt64
	var createdAt string
	var fileSize int64

	err := DB.QueryRow(
		"SELECT file_name, password, expires_in, created_at FROM uploads WHERE id = ?",
		id,
	).Scan(&filename, &password, &expiresIn, &createdAt)

	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, "File not found", http.StatusNotFound)
			return
		}
		respondWithError(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Get file size
	filePath := filepath.Join("data/uploads", filename)
	if fileInfo, err := os.Stat(filePath); err == nil {
		fileSize = fileInfo.Size()
	}

	response := FileInfoResponse{
		Filename:         filename,
		RequiresPassword: password != "",
		FileSize:         fileSize,
	}

	// Calculate expiration if set
	if expiresIn.Valid {
		createdTime, err := time.Parse(time.RFC3339, createdAt)
		if err == nil {
			expirationDate := createdTime.Add(time.Duration(expiresIn.Int64) * time.Second)
			response.ExpiresAt = expirationDate.Format(time.RFC3339)
		}
	}

	respondWithJSON(w, response, http.StatusOK)
}

// Verify password - returns download token if correct
func verifyPassword(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Rate limit: max 5 attempts per 15 minutes per file
	if !limiter.Allow(id, 5, 15*time.Minute) {
		respondWithError(w, "Too many password attempts. Try again later.", http.StatusTooManyRequests)
		return
	}

	// Parse JSON body
	var req PasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Get file details
	var password string
	var expiresIn sql.NullInt64
	var createdAt string

	err := DB.QueryRow(
		"SELECT password, expires_in, created_at FROM uploads WHERE id = ?",
		id,
	).Scan(&password, &expiresIn, &createdAt)

	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, "File not found", http.StatusNotFound)
			return
		}
		respondWithError(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Check if file has expired
	if expiresIn.Valid {
		createdTime, err := time.Parse(time.RFC3339, createdAt)
		if err != nil {
			respondWithError(w, "Error checking expiration", http.StatusInternalServerError)
			return
		}

		expirationDate := createdTime.Add(time.Duration(expiresIn.Int64) * time.Second)
		if time.Now().After(expirationDate) {
			respondWithError(w, "File has expired", http.StatusGone)
			return
		}
	}

	// Check if password is required
	if password == "" {
		respondWithError(w, "This file is not password protected", http.StatusBadRequest)
		return
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(password), []byte(req.Password))
	if err != nil {
		respondWithError(w, "Incorrect password", http.StatusUnauthorized)
		return
	}

	// Password is correct - generate download token (valid for 5 minutes)
	token := tokenStore.Generate(id, 5*time.Minute)

	response := VerifyResponse{
		Message:       "Password verified successfully",
		DownloadToken: token,
		ExpiresIn:     300, // 5 minutes in seconds
	}

	respondWithJSON(w, response, http.StatusOK)
}

// Download file - requires valid token
func downloadFile(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Parse JSON body to get token
	var req DownloadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, "Invalid JSON or missing token", http.StatusBadRequest)
		return
	}

	if req.Token == "" {
		respondWithError(w, "Download token required", http.StatusUnauthorized)
		return
	}

	// Validate token
	fileID, valid := tokenStore.Validate(req.Token)
	if !valid {
		respondWithError(w, "Invalid or expired token", http.StatusUnauthorized)
		return
	}

	// Verify token matches file ID
	if fileID != id {
		respondWithError(w, "Token does not match file", http.StatusUnauthorized)
		return
	}

	// Get file details
	var filename string
	var expiresIn sql.NullInt64
	var createdAt string

	err := DB.QueryRow(
		"SELECT file_name, expires_in, created_at FROM uploads WHERE id = ?",
		id,
	).Scan(&filename, &expiresIn, &createdAt)

	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, "File not found", http.StatusNotFound)
			return
		}
		respondWithError(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Check if file has expired
	if expiresIn.Valid {
		createdTime, err := time.Parse(time.RFC3339, createdAt)
		if err != nil {
			respondWithError(w, "Error checking expiration", http.StatusInternalServerError)
			return
		}

		expirationDate := createdTime.Add(time.Duration(expiresIn.Int64) * time.Second)
		if time.Now().After(expirationDate) {
			respondWithError(w, "File has expired", http.StatusGone)
			return
		}
	}

	// Check if file exists on disk
	filePath := filepath.Join("data/uploads", filename)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		respondWithError(w, "File not found on disk", http.StatusNotFound)
		return
	}

	// Serve the file
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	http.ServeFile(w, r, filePath)
}

func uploadFile(w http.ResponseWriter, r *http.Request) {
	// Set max upload size to 3GB (3 * 1024 * 1024 * 1024 bytes)
	r.Body = http.MaxBytesReader(w, r.Body, 3*1024*1024*1024)

	// Parse the multipart form with 32MB max memory
	err := r.ParseMultipartForm(32 << 20)
	if err != nil {
		respondWithError(w, "File too large or error parsing form", http.StatusBadRequest)
		return
	}

	// Get the file from the form
	file, header, err := r.FormFile("file")
	if err != nil {
		respondWithError(w, "Error retrieving file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Get optional form fields
	expiresIn := r.FormValue("expires_in") // seconds as string
	message := r.FormValue("message")
	email := r.FormValue("email")
	reciever := r.FormValue("reciever")
	password := r.FormValue("password")

	// Hash the password if provided
	var hashedPassword string
	if password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			respondWithError(w, "Error processing password", http.StatusInternalServerError)
			return
		}
		hashedPassword = string(hash)
	}

	// Create uploads directory if it doesn't exist
	err = os.MkdirAll("data/uploads", os.ModePerm)
	if err != nil {
		respondWithError(w, "Error creating uploads directory", http.StatusInternalServerError)
		return
	}

	// Sanitize filename
	filename := filepath.Base(header.Filename)

	// Create the destination file
	dst, err := os.Create(filepath.Join("data/uploads", filename))
	if err != nil {
		respondWithError(w, "Error creating file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Copy the uploaded file to the destination
	_, err = io.Copy(dst, file)
	if err != nil {
		respondWithError(w, "Error saving file", http.StatusInternalServerError)
		return
	}

	// Save to database with hashed password
	var result sql.Result
	result, err = DB.Exec(
		"INSERT INTO uploads (file_name, email, password, reciever, expires_in, message) VALUES (?, ?, ?, ?, ?, ?)",
		filename, email, hashedPassword, reciever, expiresIn, message,
	)

	if err != nil {
		log.Println(err)
		respondWithError(w, "Error saving to database", http.StatusInternalServerError)
		return
	}

	// Get the inserted ID
	fileID, err := result.LastInsertId()
	if err != nil {
		log.Println(err)
	}

	// Send email to reciever (commented out)
	//sendMail(reciever, fmt.Sprintf("You have a new file: %s (%d bytes)\nAccess at: http://localhost:3000/upload/%d", filename, header.Size, fileID))

	// Success response
	response := map[string]interface{}{
		"message":      "File uploaded successfully",
		"filename":     filename,
		"file_size":    header.Size,
		"file_id":      fileID,
		"info_url":     fmt.Sprintf("/upload/%d/info", fileID),
		"verify_url":   fmt.Sprintf("/upload/%d/verify", fileID),
		"download_url": fmt.Sprintf("/upload/%d/download", fileID),
	}

	respondWithJSON(w, response, http.StatusOK)
}

func sendMail(to string, body string) {
	// Create a new message
	message := gomail.NewMessage()

	// Set email headers
	message.SetHeader("From", "info@davutkilic-bau.com")
	message.SetHeader("To", to)
	message.SetHeader("Subject", "You have a new File!")

	// Set email body
	message.SetBody("text/plain", body)

	// Set up the SMTP dialer
	dialer := gomail.NewDialer("smtp.hostinger.com", 587, "info@davutkilic-bau.com", "cyttan-nyfpow-1toCfy")

	// Send the email
	if err := dialer.DialAndSend(message); err != nil {
		fmt.Println("Error:", err)
		panic(err)
	} else {
		fmt.Println("Email sent successfully!")
	}
}

func initDB() {
	var err error
	// Create data directory if it doesn't exist
	err = os.MkdirAll("data", os.ModePerm)
	if err != nil {
		log.Fatal("Error creating data directory:", err)
	}

	// Open a connection to the SQLite database file named data.db
	DB, err = sql.Open("sqlite3", "./data/data.db")
	if err != nil {
		// Log an error and stop the program if the database can't be opened
		log.Fatal(err)
	}

	// SQL statement to create the uploads table if it doesn't exist
	sqlStmt := `
	CREATE TABLE IF NOT EXISTS uploads (
		id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
		file_name TEXT NOT NULL,
		email TEXT NOT NULL,
		password TEXT,
		reciever TEXT NOT NULL,
		expires_in INTEGER NOT NULL,  -- expiration time in SECONDS
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		message TEXT
		);`

	_, err = DB.Exec(sqlStmt)
	if err != nil {
		// Log an error if table creation fails
		log.Fatalf("Error creating table: %q: %s\n", err, sqlStmt)
	}
}

// Helper functions for JSON responses
func respondWithJSON(w http.ResponseWriter, data interface{}, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

func respondWithError(w http.ResponseWriter, message string, statusCode int) {
	respondWithJSON(w, ErrorResponse{Error: message}, statusCode)
}
