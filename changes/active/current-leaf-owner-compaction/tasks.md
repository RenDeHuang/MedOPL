# current-leaf-owner-compaction Tasks

- [x] Step 0: baseline audit of `goal-current.json` large blocks and consumers
- [x] Step 1: migrate current consumer from `current_leaf` duplicate to top-level owner payload
- [x] Step 2: add RED current-state index-loop assertion against owner payload duplication
- [x] Step 3: remove duplicate current leaf owner payloads
- [x] Step 4: run targeted tests
- [x] Step 5: run review gate and full verify
