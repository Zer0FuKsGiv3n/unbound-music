# Autonomous Repo Bootstrap

This file defines the initialization steps Copilot must perform to establish
a fully autonomous, self-maintaining, self-evolving architecture for the
Unbound Music project.

When instructed to "initialize autonomy", Copilot must perform the following:

---

## 1. Create the core system definition

Create a file named `/System.md` containing:

- Project purpose and philosophy
- Architecture overview
- Coding standards and style rules
- UX and UI principles
- Autonomy rules and constraints
- Forbidden actions
- Personal preferences of the creator (Danny)
- Deployment model (personal-only, private)

---

## 2. Create the autonomous folder structure

Create the following folders:

- `/Tasks/`
- `/CoreChanges/`
- `/Context/`
- `/AgentPrompts/`
- `/Copilot/`

Each folder must contain starter templates as described below.

---

## 3. Populate the Tasks folder

Inside `/Tasks/`, create:

- `task_template.md` — a reusable template containing:
  - Goal
  - Constraints
  - Acceptance criteria
  - Test expectations
  - References to System.md and Context/

---

## 4. Populate the CoreChanges folder

Inside `/CoreChanges/`, create:

- `core_change_template.md` — a blueprint for major architectural changes:
  - What is changing
  - Why it is changing
  - Migration steps
  - Compatibility requirements
  - Testing requirements

---

## 5. Populate the Context folder

Inside `/Context/`, create:

- `architecture.md`
- `music_data_model.md`
- `style_rules.md`
- `user_experience.md`

These files store reusable knowledge to prevent repeated prompts.

---

## 6. Populate the AgentPrompts folder

Inside `/AgentPrompts/`, create:

- `prompt_template.prompt` — a token-efficient agent instruction template referencing:
  - System.md
  - Context/
  - Tasks/
  - CoreChanges/

---

## 7. Create the Copilot orchestration layer

Inside `/Copilot/`, create:

- `orchestration.md` — defines Copilot’s planning and coordination behavior
- `prompt_rules.md` — defines how Copilot generates optimized prompts
- `workflow_plan.md` — defines the autonomous loop:
  1. User requests a change
  2. Copilot generates tasks
  3. Copilot generates agent prompts
  4. Execution agent performs the work
  5. Copilot reviews and merges PRs

---

## 8. Create Compatibility.md

Create `/Compatibility.md` containing stability rules:

- API shapes
- Data models
- UX flows
- File structure
- Naming conventions

---

## 9. Generate GitHub Actions workflows

Copilot must generate workflows that:

- Review PRs
- Enforce coding standards
- Maintain repo consistency
- Support autonomous updates

---

## 10. Establish autonomy

After creating all files and folders, Copilot must:

- Read System.md
- Adopt prompt_rules.md
- Follow orchestration.md
- Use workflow_plan.md for all future tasks

This completes the autonomous initialization.
