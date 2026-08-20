import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { Fragment, type ReactNode } from "react";

/**
 * The small slice of Markdown the assistant actually emits.
 *
 * The model writes `**bold**`, `` `code` `` and bullet lists whatever it is told
 * not to, and rendering the raw string put literal asterisks on screen —
 * "I found the **Seo** board" — which reads as a bug to everyone who sees it.
 *
 * A full Markdown pipeline is the wrong answer here: it is a dependency, a
 * sanitiser and an HTML injection surface, all to format four constructs inside
 * a chat bubble. This builds React nodes instead of HTML, so there is no
 * `dangerouslySetInnerHTML` anywhere and no way for model output to become
 * markup. Anything it does not recognise falls through as plain text, which is
 * the correct failure: an unhandled construct looks slightly plain rather than
 * breaking the panel.
 */

/**
 * An in-app destination the assistant referred to.
 *
 * Rendered as a chip rather than a blue underline: a reply that names four
 * tasks becomes four things you can open, which is the difference between the
 * assistant telling you about your work and handing it to you.
 *
 * Only same-origin paths get this treatment — see `renderInline`.
 */
function InternalLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href as Route}
      className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md bg-foreground/10 px-1.5 py-0.5 align-baseline text-[0.9em] font-medium transition-colors hover:bg-foreground/20"
    >
      <span className="truncate">{label}</span>
      <ArrowUpRightIcon className="size-3 shrink-0 opacity-60" aria-hidden="true" />
    </Link>
  );
}

/** Splits one line into text, `**bold**`, `` `code` `` and `[label](/path)` runs. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // One pass over every construct, so `**a `b` c**` cannot interleave into
  // mismatched pairs the way sequential passes would allow.
  const pattern = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);

    if (link?.[1] && link[2]) {
      /*
        Internal paths only. The model writes these from ids in its context, but
        a model can write any string — rendering an arbitrary href would turn a
        prompt-injected message into a phishing link inside your own product.
        Anything not starting with a single `/` falls through as plain text,
        which is visible and harmless.
      */
      const isInternal = link[2].startsWith("/") && !link[2].startsWith("//");

      nodes.push(
        isInternal ? (
          <InternalLink key={key} href={link[2]} label={link[1]} />
        ) : (
          <span key={key}>{link[1]}</span>
        ),
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code
          key={key}
          className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.8125em]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

/**
 * A structured card the assistant chose to draw.
 *
 * Emitted as a fenced ```card block holding JSON. That is deliberately not the
 * same as making the whole reply JSON: a model that must return a valid document
 * every time will eventually not, and the failure mode there is a blank panel.
 * Here a malformed card is just a fenced block that did not parse, so it renders
 * as text and the conversation continues.
 *
 * Every field is checked at runtime. This content originates from a model and
 * can quote tasks and comments other people wrote, so nothing about its shape
 * can be assumed.
 */
type Card = {
  title: string;
  severity: "high" | "medium" | "low";
  message?: string;
  items?: { label: string; href?: string }[];
};

const SEVERITY_COLOR: Record<Card["severity"], string> = {
  high: "var(--priority-urgent)",
  medium: "var(--priority-medium)",
  low: "var(--muted-foreground)",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Returns null for anything that is not a card we can render safely. */
function parseCard(raw: string): Card | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || typeof parsed.title !== "string") {
    return null;
  }

  const severity =
    parsed.severity === "high" || parsed.severity === "medium"
      ? parsed.severity
      : "low";

  const items = Array.isArray(parsed.items)
    ? parsed.items.flatMap((item) => {
        if (!isRecord(item) || typeof item.label !== "string") {
          return [];
        }

        // Same rule as inline links: internal paths only, so a model cannot
        // put an outbound URL inside your own product.
        const href =
          typeof item.href === "string" &&
          item.href.startsWith("/") &&
          !item.href.startsWith("//")
            ? item.href
            : undefined;

        return [{ label: item.label, href }];
      })
    : undefined;

  return {
    title: parsed.title,
    severity,
    message: typeof parsed.message === "string" ? parsed.message : undefined,
    items,
  };
}

function CardBlock({ card }: { card: Card }) {
  return (
    <div className="card-surface my-1 px-3.5 py-3">
      <p className="flex items-start gap-2 text-sm font-medium text-pretty">
        <span
          aria-hidden="true"
          className="mt-1.5 size-1.5 shrink-0 rounded-full"
          style={{ background: SEVERITY_COLOR[card.severity] }}
        />
        {card.title}
      </p>

      {card.message ? (
        <p className="mt-1 pl-3.5 text-sm text-pretty opacity-90">
          {card.message}
        </p>
      ) : null}

      {card.items && card.items.length > 0 ? (
        <ul className="mt-2 space-y-1 pl-3.5">
          {card.items.map((item, index) => (
            <li key={index} className="text-sm">
              {item.href ? (
                <Link
                  href={item.href as Route}
                  className="inline-flex items-center gap-1 rounded-md bg-foreground/10 px-1.5 py-0.5 font-medium transition-colors hover:bg-foreground/20"
                >
                  <span className="truncate">{item.label}</span>
                  <ArrowUpRightIcon
                    className="size-3 shrink-0 opacity-60"
                    aria-hidden="true"
                  />
                </Link>
              ) : (
                <span className="opacity-90">{item.label}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type Block =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "card"; card: Card };

/** Groups lines into paragraphs, bullet runs and card fences. */
function toBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  // Non-null while inside a ```card fence, collecting its JSON.
  let cardLines: string[] | null = null;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trimEnd();

    if (cardLines !== null) {
      if (line.trim().startsWith("```")) {
        const card = parseCard(cardLines.join("\n"));

        // A fence that did not parse is not dropped — it becomes the text it
        // always was, so a malformed card costs formatting, never content.
        blocks.push(
          card
            ? { kind: "card", card }
            : { kind: "paragraph", lines: cardLines },
        );

        cardLines = null;
        continue;
      }

      cardLines.push(line);
      continue;
    }

    if (/^```s*cards*$/.test(line.trim())) {
      cardLines = [];
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const last = blocks.at(-1);

    if (bullet?.[1] !== undefined) {
      if (last?.kind === "list") {
        last.items.push(bullet[1]);
      } else {
        blocks.push({ kind: "list", items: [bullet[1]] });
      }

      continue;
    }

    if (line.trim() === "") {
      // A blank line ends whatever was open; two in a row add nothing.
      if (last !== undefined && !(last.kind === "paragraph" && last.lines.length === 0)) {
        blocks.push({ kind: "paragraph", lines: [] });
      }

      continue;
    }

    if (last?.kind === "paragraph") {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "paragraph", lines: [line] });
    }
  }

  if (cardLines !== null && cardLines.length > 0) {
    blocks.push({ kind: "paragraph", lines: cardLines });
  }

  // Drops the empty paragraphs blank lines leave behind. Lists and cards are
  // never empty by construction.
  return blocks.filter(
    (block) => block.kind !== "paragraph" || block.lines.length > 0,
  );
}

export function MessageContent({ content }: { content: string }) {
  const blocks = toBlocks(content);

  return (
    <div className="space-y-2">
      {blocks.map((block, index) =>
        block.kind === "list" ? (
          <ul key={index} className="space-y-1 pl-1">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-[0.4375rem] size-1 shrink-0 rounded-full bg-current opacity-50"
                />
                <span className="min-w-0 flex-1">
                  {renderInline(item, `${index}-${itemIndex}`)}
                </span>
              </li>
            ))}
          </ul>
        ) : block.kind === "card" ? (
          <CardBlock key={index} card={block.card} />
        ) : (
          <p key={index} className="text-pretty">
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {renderInline(line, `${index}-${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
