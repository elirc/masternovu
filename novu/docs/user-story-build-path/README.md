# User Story Build Path

Use these stories as real tickets. Start with Story 1 even if it feels easy, because the early stories train you to touch the repo without getting lost. Stories 1-3 are small UI edits, Stories 4-5 add UI behavior from existing data, Stories 6-7 introduce API/state changes, Stories 8-9 are full-stack changes, and Story 10 asks you to design with architectural consequences.

A story is done when every acceptance criterion is independently verifiable, the touched files match existing patterns, the code builds or the relevant test path is known, and you can explain the flow using file names and functions.

When stuck, use this prompt with Claude or ChatGPT:

```text
I'm working on Story X. I'm stuck on Y. Here is what I've tried: Z.
Don't give me the solution. Ask me questions that help me figure it out.
Use these repo anchors: [paste the files/functions/line ranges I am touching].
```

Do not ask for code first. Ask for questions, hints, and checks. Your goal is to build debugging muscle, not outsource the reps.
