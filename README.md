# Convert Markdown to Google Docs

Google does not have a way to convert HTML or Markdown to Google Docs. This little project takes incoming Markdown, parses it into an AST tree, and then transforms that to Google Docs API requests, which generate the resulting document.

## Usage

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.0.30. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Google API Scopes

TODO define scopes
google docs api
google drive api
