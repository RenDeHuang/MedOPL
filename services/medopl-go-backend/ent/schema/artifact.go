package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Artifact struct {
	ent.Schema
}

func (Artifact) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().Unique().Immutable(),
		field.String("run_id").NotEmpty(),
		field.String("workspace_id").NotEmpty(),
		field.String("kind").Default("output"),
		field.String("status").Default("available"),
		field.String("external_ref").Optional().Nillable(),
		field.JSON("payload", map[string]any{}),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Artifact) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("run", Run.Type).Ref("artifacts").Field("run_id").Required().Unique(),
		edge.From("workspace", Workspace.Type).Ref("artifacts").Field("workspace_id").Required().Unique(),
	}
}

func (Artifact) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("run_id"),
		index.Fields("workspace_id"),
	}
}
