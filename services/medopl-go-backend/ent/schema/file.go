package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type File struct {
	ent.Schema
}

func (File) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().Unique().Immutable(),
		field.String("workspace_id").NotEmpty(),
		field.String("name").NotEmpty(),
		field.String("kind").Default("input"),
		field.String("status").Default("available"),
		field.String("external_ref").Optional().Nillable(),
		field.JSON("payload", map[string]any{}),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (File) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("workspace", Workspace.Type).Ref("files").Field("workspace_id").Required().Unique(),
	}
}

func (File) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("workspace_id"),
		index.Fields("workspace_id", "name").Unique(),
	}
}
