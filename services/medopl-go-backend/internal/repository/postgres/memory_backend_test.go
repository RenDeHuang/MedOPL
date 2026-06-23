package postgres

import (
	"context"
	"sort"
	"sync"
	"testing"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
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

type typedRuntimeLifecycleTestDB struct {
	*memoryTestDB
	ledgers           map[string]cpd.ResourceBindingLedger
	operations        map[string]cpd.CloudOperation
	genericWriteCount int
}

func newTypedRuntimeLifecycleTestDB(t *testing.T) *typedRuntimeLifecycleTestDB {
	t.Helper()
	return &typedRuntimeLifecycleTestDB{
		memoryTestDB: NewMemoryTestDB(t),
		ledgers:      make(map[string]cpd.ResourceBindingLedger),
		operations:   make(map[string]cpd.CloudOperation),
	}
}

func (db *typedRuntimeLifecycleTestDB) UpsertRecord(ctx context.Context, record Record) error {
	db.genericWriteCount++
	return db.memoryTestDB.UpsertRecord(ctx, record)
}

func (db *typedRuntimeLifecycleTestDB) UpsertResourceBindingLedger(ctx context.Context, ledger cpd.ResourceBindingLedger) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	db.ledgers[ledger.ResourceBindingID] = ledger
	return nil
}

func (db *typedRuntimeLifecycleTestDB) ResourceBindingLedger(ctx context.Context, resourceBindingID string) (cpd.ResourceBindingLedger, error) {
	if err := ctx.Err(); err != nil {
		return cpd.ResourceBindingLedger{}, err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	ledger, ok := db.ledgers[resourceBindingID]
	if !ok {
		return cpd.ResourceBindingLedger{}, cprepo.ErrNotFound
	}
	return ledger, nil
}

func (db *typedRuntimeLifecycleTestDB) ListResourceBindingLedgers(ctx context.Context, workspaceID string) ([]cpd.ResourceBindingLedger, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	items := []cpd.ResourceBindingLedger{}
	for _, ledger := range db.ledgers {
		if workspaceID == "" || ledger.WorkspaceID == workspaceID {
			items = append(items, ledger)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ResourceBindingID < items[j].ResourceBindingID
	})
	return items, nil
}

func (db *typedRuntimeLifecycleTestDB) UpsertCloudOperation(ctx context.Context, operation cpd.CloudOperation) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	db.operations[operation.OperationID] = operation
	return nil
}

func (db *typedRuntimeLifecycleTestDB) CloudOperation(ctx context.Context, operationID string) (cpd.CloudOperation, error) {
	if err := ctx.Err(); err != nil {
		return cpd.CloudOperation{}, err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	operation, ok := db.operations[operationID]
	if !ok {
		return cpd.CloudOperation{}, cprepo.ErrNotFound
	}
	return operation, nil
}
