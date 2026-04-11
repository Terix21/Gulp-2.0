# Manual Test Plan Template

> Copy this file and replace all `{{PLACEHOLDER}}` tokens before use.
> Status values: **Pass** | **Fail** | **Blocked** | **Skip** | **N/T** (Not Tested)

---

## Header

| Field           | Value                    |
|-----------------|--------------------------|
| Product         | {{PRODUCT_NAME}}         |
| Version / Build | {{VERSION_OR_BUILD}}     |
| Test Plan ID    | {{PLAN_ID}}              |
| Author          | {{AUTHOR}}               |
| Date            | {{DATE}}                 |
| Environment     | {{OS / RUNTIME / ARCH}}  |

---

## 1. Objectives

> State what this plan is validating in 2–4 sentences.

{{OBJECTIVES}}

---

## 2. Scope

### 2.1 In Scope
- {{IN_SCOPE_ITEM_1}}
- {{IN_SCOPE_ITEM_2}}

### 2.2 Out of Scope
- {{OUT_OF_SCOPE_ITEM_1}}
- {{OUT_OF_SCOPE_ITEM_2}}

---

## 3. Environment Setup

### Prerequisites
1. {{PREREQ_1}}
2. {{PREREQ_2}}

### Build Steps
```
{{BUILD_COMMAND}}
```

### Launch Steps
```
{{LAUNCH_COMMAND}}
```

---

## 4. Test Case Conventions

| Column          | Meaning                                               |
|-----------------|-------------------------------------------------------|
| ID              | Unique test ID, e.g. `TC-<MODULE>-<NNN>`             |
| Title           | One-line description                                  |
| Preconditions   | State required before executing steps                 |
| Steps           | Numbered, action-oriented instructions                |
| Expected Result | Observable outcome that constitutes a pass            |
| Actual Result   | Leave blank; fill in during execution                 |
| Status          | Pass / Fail / Blocked / Skip / N/T                   |
| Notes           | Defect IDs, deviations, follow-up items               |

---

## 5. Test Cases

### Module: {{MODULE_NAME}}

#### TC-{{MODULE_CODE}}-001 — {{TEST_TITLE}}

| Field           | Detail                          |
|-----------------|---------------------------------|
| Preconditions   | {{PRECONDITIONS}}               |
| Steps           | 1. {{STEP_1}} <br> 2. {{STEP_2}} |
| Expected Result | {{EXPECTED_RESULT}}             |
| Actual Result   |                                 |
| Status          |                                 |
| Notes           |                                 |

---

#### TC-{{MODULE_CODE}}-002 — {{TEST_TITLE}}

| Field           | Detail                          |
|-----------------|---------------------------------|
| Preconditions   | {{PRECONDITIONS}}               |
| Steps           | 1. {{STEP_1}} <br> 2. {{STEP_2}} |
| Expected Result | {{EXPECTED_RESULT}}             |
| Actual Result   |                                 |
| Status          |                                 |
| Notes           |                                 |

---

> Repeat the test case block for every case in this module, then add
> a new `### Module:` section for each additional area under test.

---

## 6. Defect Log

| Defect ID | TC ID | Summary | Severity | Status |
|-----------|-------|---------|----------|--------|
|           |       |         |          |        |

---

## 7. Execution Summary

| Module          | Total | Pass | Fail | Blocked | Skip | N/T |
|-----------------|-------|------|------|---------|------|-----|
| {{MODULE_NAME}} |       |      |      |         |      |     |
| **TOTAL**       |       |      |      |         |      |     |

### Sign-Off

| Role     | Name | Date | Signature |
|----------|------|------|-----------|
| Tester   |      |      |           |
| Reviewer |      |      |           |
