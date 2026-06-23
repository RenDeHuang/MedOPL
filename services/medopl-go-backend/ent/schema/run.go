package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Run struct {
	ent.Schema
}

func (Run) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().Unique().Immutable(),
		field.String("workspace_id").NotEmpty(),
		field.String("status").Default("pending"),
		field.String("external_ref").Optional().Nillable(),
		field.String("idempotency_key").NotEmpty(),
		field.JSON("payload", map[string]any{}),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Run) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("workspace", Workspace.Type).Ref("runs").Field("workspace_id").Required().Unique(),
		edge.To("artifacts", Artifact.Type),
		edge.To("workflow_executions", WorkflowExecution.Type),
	}
}

func (Run) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("workspace_id"),
		index.Fields("workspace_id", "idempotency_key").Unique(),
	}
}
