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

type typedRunFileArtifactTestDB struct {
	*memoryTestDB
	files             map[string]cpd.FileRecord
	runs              map[string]cpd.RunRecord
	artifacts         map[string]cpd.ArtifactRecord
	genericWriteCount int
}

func newTypedRunFileArtifactTestDB(t *testing.T) *typedRunFileArtifactTestDB {
	t.Helper()
	return &typedRunFileArtifactTestDB{
		memoryTestDB: NewMemoryTestDB(t),
		files:        make(map[string]cpd.FileRecord),
		runs:         make(map[string]cpd.RunRecord),
		artifacts:    make(map[string]cpd.ArtifactRecord),
	}
}

func (db *typedRunFileArtifactTestDB) UpsertRecord(ctx context.Context, record Record) error {
	db.genericWriteCount++
	return db.memoryTestDB.UpsertRecord(ctx, record)
}

func (db *typedRunFileArtifactTestDB) UpsertFileRecord(ctx context.Context, file cpd.FileRecord) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	db.files[file.FileRef] = file
	return nil
}

func (db *typedRunFileArtifactTestDB) FileRecord(ctx context.Context, fileRef string) (cpd.FileRecord, error) {
	if err := ctx.Err(); err != nil {
		return cpd.FileRecord{}, err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	file, ok := db.files[fileRef]
	if !ok {
		return cpd.FileRecord{}, cprepo.ErrNotFound
	}
	return file, nil
}

func (db *typedRunFileArtifactTestDB) ListFileRecords(ctx context.Context, workspaceID string) ([]cpd.FileRecord, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	items := []cpd.FileRecord{}
	for _, file := range db.files {
		if workspaceID == "" || file.WorkspaceID == workspaceID {
			items = append(items, file)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].FileRef < items[j].FileRef
	})
	return items, nil
}

type typedBillingAuditTestDB struct {
	*memoryTestDB
	audits            map[string]cpd.AuditEvent
	billingEvents     map[string]cpd.BillingEvent
	genericWriteCount int
}

func newTypedBillingAuditTestDB(t *testing.T) *typedBillingAuditTestDB {
	t.Helper()
	return &typedBillingAuditTestDB{
		memoryTestDB:  NewMemoryTestDB(t),
		audits:        make(map[string]cpd.AuditEvent),
		billingEvents: make(map[string]cpd.BillingEvent),
	}
}

func (db *typedBillingAuditTestDB) UpsertRecord(ctx context.Context, record Record) error {
	db.genericWriteCount++
	return db.memoryTestDB.UpsertRecord(ctx, record)
}

func (db *typedBillingAuditTestDB) UpsertAuditEvent(ctx context.Context, event cpd.AuditEvent) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	db.audits[event.ID] = event
	return nil
}

func (db *typedBillingAuditTestDB) ListAuditEventRecords(ctx context.Context, workspaceID string) ([]cpd.AuditEvent, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	items := []cpd.AuditEvent{}
	for _, event := range db.audits {
		if workspaceID == "" || event.WorkspaceID == workspaceID {
			items = append(items, event)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ID < items[j].ID
	})
	return items, nil
}

func (db *typedBillingAuditTestDB) UpsertBillingEvent(ctx context.Context, event cpd.BillingEvent) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	for _, existing := range db.billingEvents {
		if existing.IdempotencyKey == event.IdempotencyKey {
			return nil
		}
	}
	db.billingEvents[event.ID] = event
	return nil
}

func (db *typedBillingAuditTestDB) ListBillingEventRecords(ctx context.Context, workspaceID string) ([]cpd.BillingEvent, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	items := []cpd.BillingEvent{}
	for _, event := range db.billingEvents {
		if workspaceID == "" || event.WorkspaceID == workspaceID {
			items = append(items, event)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ID < items[j].ID
	})
	return items, nil
}

func (db *typedRunFileArtifactTestDB) UpsertRunRecord(ctx context.Context, run cpd.RunRecord) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	run.FileRefs = append([]string(nil), run.FileRefs...)
	run.InputObjectRefs = append([]string(nil), run.InputObjectRefs...)
	db.runs[run.RunID] = run
	return nil
}

func (db *typedRunFileArtifactTestDB) RunRecord(ctx context.Context, runID string) (cpd.RunRecord, error) {
	if err := ctx.Err(); err != nil {
		return cpd.RunRecord{}, err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	run, ok := db.runs[runID]
	if !ok {
		return cpd.RunRecord{}, cprepo.ErrNotFound
	}
	run.FileRefs = append([]string(nil), run.FileRefs...)
	run.InputObjectRefs = append([]string(nil), run.InputObjectRefs...)
	return run, nil
}

func (db *typedRunFileArtifactTestDB) ListRunRecords(ctx context.Context, workspaceID string) ([]cpd.RunRecord, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	items := []cpd.RunRecord{}
	for _, run := range db.runs {
		if workspaceID == "" || run.WorkspaceID == workspaceID {
			run.FileRefs = append([]string(nil), run.FileRefs...)
			run.InputObjectRefs = append([]string(nil), run.InputObjectRefs...)
			items = append(items, run)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].RunID < items[j].RunID
	})
	return items, nil
}

func (db *typedRunFileArtifactTestDB) UpsertArtifactRecord(ctx context.Context, artifact cpd.ArtifactRecord) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	artifact.SourceFileRefs = append([]string(nil), artifact.SourceFileRefs...)
	db.artifacts[artifact.ArtifactRef] = artifact
	return nil
}

func (db *typedRunFileArtifactTestDB) ArtifactRecord(ctx context.Context, artifactRef string) (cpd.ArtifactRecord, error) {
	if err := ctx.Err(); err != nil {
		return cpd.ArtifactRecord{}, err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	artifact, ok := db.artifacts[artifactRef]
	if !ok {
		return cpd.ArtifactRecord{}, cprepo.ErrNotFound
	}
	artifact.SourceFileRefs = append([]string(nil), artifact.SourceFileRefs...)
	return artifact, nil
}

func (db *typedRunFileArtifactTestDB) ListArtifactRecords(ctx context.Context, workspaceID string) ([]cpd.ArtifactRecord, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	items := []cpd.ArtifactRecord{}
	for _, artifact := range db.artifacts {
		if workspaceID == "" || artifact.WorkspaceID == workspaceID {
			artifact.SourceFileRefs = append([]string(nil), artifact.SourceFileRefs...)
			items = append(items, artifact)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ArtifactRef < items[j].ArtifactRef
	})
	return items, nil
}
