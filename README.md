# Convert Markdown to Google Docs

Google does not have a way to convert HTML or Markdown to Google Docs. This little project takes incoming Markdown, parses it into an AST tree, and then transforms that to Google Docs API requests, which generate the resulting document.

> [!IMPORTANT]  
> This project is abandoned. Google Docs supports markdown, at least sort of. You can't update a document once it has been created but you can upload a document in markdown. The main goal of this project was to convert Obsidian documents to
> Google Docs, and the new markdown support is good-enough for that, albeit not awesome.

## Usage

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## Transformation

- All block-level formatting elements add a paragraph/newline

## Google API Details

- Newlines create paragraphs

## Google API Scopes

TODO define scopes
google docs api
google drive api

## Development

- `test.only` to run a single test
