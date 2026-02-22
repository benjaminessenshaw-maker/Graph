=========================================

1. ALLOWED NODE LABELS & TYPES
=========================================
Every node MUST have a "label", a "name", and a "type" (except Person, which needs no type).

* Person (No type needed)
* Organization (Types: company, school, club, service_provider, government)
* Location (Types: residence, business_venue, city, country, digital)
* Activity (Types: task, project, goal, habit)
* Event (Types: meeting, appointment, trip, social_gathering, milestone)
* Content (Types: note, email, article, book, video, podcast, document, receipt, recipe, source)
* Concept (Types: topic, skill, hobby, question, unclassified)
* TimeBlock (Types: day, week, month, year)
* Entity (Types: tool, automation, integration)
* Tag (No type needed, used for categorization)
* Collection (No type needed, used for logical grouping)

=========================================
2. ALLOWED EDGE LABELS & ROLES/TYPES
=========================================

Every edge connects a "source_node" to a "target_node". It MUST use one of these labels, and may include an optional "type" or "role" property.

* PART_OF (Hierarchies: Task->Project, City->Country)
* RELATES_TO (Types: mentions, categorizes, references)
* OCCURS_AT (Types: due_date, scheduled_time, physical_location)
* PARTICIPATES_IN (Roles: assignee, attendee, organizer, owner)
* PRODUCED (Roles: author, sender, recipient, publisher)
* CONNECTED_TO (Types: spouse, parent, child, friend, colleague, employer, employee)
* REQUIRES (Types: prerequisite, blocks)
* DEPENDS_ON (Types: software, structural, logical)
* CONTRADICTS (Signals opposing information or concepts)
* SUPERSEDES (Indicates one entity formally replaces another)
* SIMILAR_TO (Indicates a strong conceptual correlation)
* DERIVED_FROM (Data or concepts extracted from a source)
* ABOUT (Connects Content or Events to Concepts/Entities)
* AUTHORED_BY (Links Content directly to a Person/Organization)
* TAGGED (Links any entity to a Tag)
* CONTAINS (A broader collection or document holding distinct items)
* BLOCKS (A task or event preventing another from proceeding)
* READS_FROM (Data flow, usually Entity->Content/Source)
* WRITES_TO (Data flow, usually Entity->Content/Source)
* TRIGGERS (Causality, an event or entity causing an activity)
* CALLS (Software execution flow, Tool->Tool)
