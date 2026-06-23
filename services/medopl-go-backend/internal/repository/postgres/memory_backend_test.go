package postgres

import (
	"context"
	"sort"
	"sync"
	"testing"

	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
)

type memoryTestDB struct {
	mu      sync.Mutex
	records map[string]Record
}

func NewMemoryTestDB(t *testing.T) *memoryTestDB {
	t.Helper()
	return &memoryTestDB{records: make(map[string]Record)}
}

func (db *memoryTestDB) UpsertRecord(ctx context.Context, record Record) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	record.Payload = append([]byte(nil), record.Payload...)
	db.records[record.Kind+":"+record.RecordID] = record
	return nil
}

func (db *memoryTestDB) Record(ctx context.Context, kind string, recordID string) (Record, error) {
	if err := ctx.Err(); err != nil {
		return Record{}, err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	record, ok := db.records[kind+":"+recordID]
	if !ok {
		return Record{}, cprepo.ErrNotFound
	}
	record.Payload = append([]byte(nil), record.Payload...)
	return record, nil
}

func (db *memoryTestDB) ListRecords(ctx context.Context, kind string, workspaceID string) ([]Record, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	items := []Record{}
	for _, record := range db.records {
		if record.Kind != kind {
			continue
		}
		if workspaceID != "" && record.WorkspaceID != workspaceID {
			continue
		}
		record.Payload = append([]byte(nil), record.Payload...)
		items = append(items, record)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].RecordID < items[j].RecordID
	})
	return items, nil
}
