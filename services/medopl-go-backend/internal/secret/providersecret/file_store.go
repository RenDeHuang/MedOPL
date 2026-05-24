package providersecret

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var unsafeRefPattern = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

type Secret struct {
	Provider string
	Source   string
	APIKey   string
}

type FileStore struct {
	root string
}

type filePayload struct {
	Version   string `json:"version"`
	Provider  string `json:"provider"`
	Source    string `json:"source"`
	APIKey    string `json:"apiKey"`
	CreatedAt string `json:"createdAt"`
}

func NewFileStore(root string) *FileStore {
	return &FileStore{root: strings.TrimSpace(root)}
}

func NormalizeRef(value string) string {
	normalized := unsafeRefPattern.ReplaceAllString(strings.TrimSpace(value), "-")
	return strings.Trim(normalized, "-")
}

func (store *FileStore) WriteProviderSecret(ref string, secret Secret) error {
	if store == nil || strings.TrimSpace(store.root) == "" {
		return errors.New("provider_secret_root_required")
	}
	normalizedRef := NormalizeRef(ref)
	if normalizedRef == "" {
		return errors.New("provider_secret_ref_required")
	}
	if strings.TrimSpace(secret.Provider) != "gflabtoken" {
		return errors.New("provider_secret_provider_invalid")
	}
	if strings.TrimSpace(secret.Source) != "user_input" {
		return errors.New("provider_secret_source_invalid")
	}
	apiKey := strings.TrimSpace(secret.APIKey)
	if apiKey == "" {
		return errors.New("provider_secret_api_key_required")
	}
	if err := os.MkdirAll(store.root, 0o700); err != nil {
		return err
	}
	payload, err := json.Marshal(filePayload{
		Version:   "v1",
		Provider:  "gflabtoken",
		Source:    "user_input",
		APIKey:    apiKey,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(store.root, normalizedRef+".json"), append(payload, '\n'), 0o600)
}
