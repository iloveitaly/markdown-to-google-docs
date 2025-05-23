import { invariant } from "@epic-web/invariant";
import Markdoc, { Tokenizer, type Node } from "@markdoc/markdoc";

// https://developers.google.com/docs/api/reference/rest/v1/documents/request

function blockTagToGoogleDocs(node: Node): Object {
  switch (node.type) {
    case "heading":
      const headingLevel = node.attributes.level;
      return {
        paragraphStyle: {
          namedStyleType: `HEADING_${headingLevel}`,
        },
        fields: "namedStyleType",
      };
    default:
      throw new Error(`Unsupported block tag type: ${node.type}`);
  }
}

function inlineTagToGoogleDocs(node: Node): Object {
  switch (node.type) {
    case "code":
      return {
        textStyle: {
          weightedFontFamily: {
            fontFamily: "Consolas",
            weight: 400,
          },
          backgroundColor: {
            color: {
              rgbColor: {
                red: 0.97,
                green: 0.97,
                blue: 0.97,
              },
            },
          },
        },
        fields: "weightedFontFamily,backgroundColor",
      };

    case "strong":
      return {
        textStyle: {
          bold: true,
        },
        fields: "bold",
      };
    case "link":
      return {
        textStyle: {
          link: {
            url: node.attributes.href,
          },
        },
        fields: "link",
      };
    case "em":
      return {
        textStyle: {
          italic: true,
        },
        fields: "italic",
      };
    default:
      throw new Error(`Unsupported inline tag type: ${node.type}`);
  }
}

export function markdownToGoogleDocs(rawMarkdown: string) {
  // a custom tokenizer that allows us to parse comments so we can remove them!
  const tokenizer = new Tokenizer({ allowComments: true });
  const tokenizedMarkdown = tokenizer.tokenize(rawMarkdown);

  const ast = Markdoc.parse(tokenizedMarkdown, { location: true });
  const errors = Markdoc.validate(ast);

  console.log(ast);

  // TODO should check errors

  const requests = [];

  let inlineStack: { location: number; node: Node }[] = [];
  let blockStack: { location: number; node: Node }[] = [];

  let textLocation = 1;

  function isNestedList() {
    return (
      blockStack.length > 1 &&
      blockStack[blockStack.length - 1].node.type == "list" &&
      blockStack[blockStack.length - 2].node.type == "list"
    );
  }

  /**
   * Renders the entire inline style stack by pushing it on to the batch request stack
   */
  function renderInlineStyles() {
    if (inlineStack.length === 0) {
      return;
    }

    const stackItem = inlineStack.pop();
    invariant(stackItem, "must have at least one item");

    if (stackItem.node.type === "item") {
      addNewline();
      textLocation += 1;
    } else {
      requests.push({
        updateTextStyle: {
          ...inlineTagToGoogleDocs(stackItem.node),
          range: {
            startIndex: stackItem.location,
            endIndex: textLocation,
          },
        },
      });
    }
  }

  /**
   * Adds a newline to the last text request in the stack
   */
  function addNewline(): void {
    // find last insertText object in `requests`
    let lastInsertTextIndex = null;

    for (let i = requests.length - 1; i >= 0; i--) {
      if (requests[i].hasOwnProperty("insertText")) {
        lastInsertTextIndex = i;
        break;
      }
    }

    invariant(
      lastInsertTextIndex !== null,
      "always should have an index if adding a newline",
    );

    requests[lastInsertTextIndex].insertText.text += "\n";
  }

  function renderBlockStyles(currentNode: Node | null) {
    if (blockStack.length === 0) {
      return;
    }

    if (requests.length === 0) {
      return;
    }

    // TODO there can be nested blocks (lists), we need to support this
    // if (blockStack.length > 1) {
    //   throw new Error("Multiple block tags not supported")
    // }

    console.log(blockStack);

    for (let i = blockStack.length - 1; i >= 0; i--) {
      // this doesn't work: the stack never gets rendered
      const stopRender =
        blockStack[i].node.type == "list" &&
        currentNode != null &&
        currentNode.type == "item";
      if (stopRender) {
        break;
      }

      const blockItem = blockStack.pop();

      const isNestedList =
        blockStack.length > 0 &&
        blockStack[blockStack.length - 1].node.type === "list";
      // while (blockItem = blockStack.pop()) {

      // const blockItem = blockStack.pop()
      // invariant(blockItem, "we know there is one item")

      // invariant(blockItem.location !== textLocation, `start and ending range should never be the same ${blockItem.node.type}`)

      addNewline();

      if (
        blockItem.node.type === "paragraph" ||
        blockItem.node.type == "blockquote"
      ) {
        addNewline();
        textLocation += 1;
      } else if (blockItem.node.type == "item") {
        // noop, all we need is a newline
      } else if (blockItem.node.type === "list") {
        requests.push({
          createParagraphBullets: {
            range: {
              startIndex: blockItem.location,
              endIndex: textLocation,
            },
            // TODO should support different list types
            bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
          },
        });
      } else {
        requests.push({
          updateParagraphStyle: {
            range: {
              startIndex: blockItem.location,
              endIndex: textLocation,
            },
            ...blockTagToGoogleDocs(blockItem.node),
          },
        });
      }

      textLocation += 1;
      if (stopRender) {
        break;
      }
    }
  }

  // console.log([...ast.walk()])

  // the walk descends into the tree and calls the callback for each node
  // this is the main entrypoint for the md => gdoc conversion
  for (const node of ast.walk()) {
    if (node.type == "inline") {
      // TODO still not really sure what this does... this will bite us
      continue;
    }

    // I think we are going to have to special case items here
    // items are inline-block in a sense: we want to render a newline when (a) we aren't in a list anymore or (b) we encountered the next item

    if (!node.inline) {
      renderInlineStyles();

      // items are inline, but we don't want to close out the list block until all items have been consumed
      console.log("rendering block styles from node: ", node.type);
      // although items are block level, we do not treat them as such
      renderBlockStyles(node);
    }

    const isNestedList =
      blockStack.length > 0 &&
      blockStack[blockStack.length - 1].node.type === "list";

    switch (node.type) {
      case "paragraph":
      case "heading":
      case "item":
      // TODO blockquote should really be different!
      case "blockquote":
        // lists are tricky, if they are nested we want to treat them as inline
        // because entries should be prefixed with a tab character
        blockStack.push({ location: textLocation, node: node });
        break;

      case "list":
        blockStack.push({ location: textLocation, node: node });
        break;

      // falls through
      case "code":
        // inline styles with also contain text
        inlineStack.push({ location: textLocation, node: node });
      // falls through
      case "text":
        let textContent = node.attributes.content;

        requests.push({
          insertText: {
            location: {
              index: textLocation,
            },
            text: textContent,
          },
        });

        textLocation += textContent.length;

        renderInlineStyles();
        break;

      case "strong":
      case "em":
      case "link":
        invariant(
          node.attributes.content === undefined,
          `no content should exist in inline tags '${node.type}'. Content: ${node.attributes.content}`,
        );
        inlineStack.push({ location: textLocation, node: node });
        break;
      case "hr":
        // hr is not supported by the REST API
        // https://stackoverflow.com/questions/59501947/is-it-possible-to-insert-a-horizontal-rule-with-google-docs-api
        // TODO if this is ever supported by the gdocs api, add support for it!
        break;
      case "softbreak":
        // TODO unclear what this is and where it is used...
        break;

      // case "list":
      //   if (node.inline) {
      //     throw new Error("Inline list not supported / this shouldn't be possible")
      //   }

      //   // attributes.ordered
      //   // debugger
      //   break
      // "list item"
      case "image":
        // TODO these will be hard
        break;

      // we don't want to render HTML comments in the gdoc
      case "comment":
        break;

      default:
        throw new Error(`Unsupported node type: ${node.type}`);
    }
  }

  renderBlockStyles(null);

  // sort all requests so the insertText goes first, then the style applications
  requests.sort((a, b) => {
    // if both are insertText, then sort by location.index
    if (a.insertText && b.insertText) {
      return a.insertText.location.index - b.insertText.location.index;
    }

    if (a.insertText) {
      return -1;
    }

    return 1;
  });

  return requests;
}
