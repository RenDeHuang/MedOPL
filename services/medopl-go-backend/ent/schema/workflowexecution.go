package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type WorkflowExecution struct {
	ent.Schema
}

func (WorkflowExecution) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().Unique().Immutable(),
		field.String("workspace_id").NotEmpty(),
		field.String("run_id").Optional().Nillable(),
		field.String("command_type").NotEmpty(),
		field.String("status").Default("pending"),
		field.String("idempotency_key").NotEmpty().Unique(),
		field.String("external_ref").Optional().Nillable(),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (WorkflowExecution) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("workspace", Workspace.Type).Ref("workflow_executions").Field("workspace_id").Required().Unique(),
		edge.From("run", Run.Type).Ref("workflow_executions").Field("run_id").Unique(),
	}
}

func (WorkflowExecution) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("workspace_id"),
		index.Fields("run_id"),
		index.Fields("idempotency_key").Unique(),
	}
}
