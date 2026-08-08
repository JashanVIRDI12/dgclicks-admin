import {
  CalendarDaysIcon,
  CheckSquareIcon,
  KanbanIcon,
  KeyboardIcon,
  LayersIcon,
  PaperclipIcon,
  PlusIcon,
  RepeatIcon,
  SearchIcon,
  ShieldCheckIcon,
  TimerIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FadeIn } from "@/components/common/fade-in";
import { PageHeader } from "@/components/common/page-header";
import { requireSession } from "@/features/auth/server/session";
import { HierarchyDiagram } from "@/features/tutorial/components/hierarchy-diagram";
import {
  Card,
  Key,
  Note,
  Section,
  ShortcutRow,
  Steps,
} from "@/features/tutorial/components/tutorial-parts";

export const metadata: Metadata = {
  title: "How it works",
};

const CONTENTS = [
  { id: "structure", label: "How it is organised" },
  { id: "access", label: "Who can do what" },
  { id: "board", label: "The board" },
  { id: "new-task", label: "Adding a task" },
  { id: "task", label: "Opening a task" },
  { id: "checklists", label: "Checklists and subtasks" },
  { id: "repeat", label: "Repeating work" },
  { id: "views", label: "Four views" },
  { id: "files", label: "Files and time" },
  { id: "search", label: "Search" },
  { id: "keyboard", label: "Keyboard" },
];

export default async function TutorialPage() {
  await requireSession();

  return (
    <div className="space-y-8">
      <PageHeader
        title="How it works"
        description="Everything this app does, and the handful of choices it makes that are worth knowing about."
      />

      <FadeIn>
        <nav aria-label="On this page" className="flex flex-wrap gap-1.5">
          {CONTENTS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </FadeIn>

      <FadeIn delay={0.05} className="max-w-2xl space-y-12">
        <Section
          id="structure"
          icon={LayersIcon}
          title="How it is organised"
          lede="Five levels, each one inside the last."
        >
          <HierarchyDiagram />

          <Note title="Workspaces are separate worlds">
            A board belongs to exactly one workspace, and you only see boards in
            workspaces you are a member of. The switcher at the top of the
            sidebar changes which one the Dashboard, Calendar and Reports are
            about. Add or remove people in{" "}
            <Link href="/settings" className="underline underline-offset-2">
              Settings
            </Link>
            .
          </Note>
        </Section>

        <Section
          id="access"
          icon={ShieldCheckIcon}
          title="Who can do what"
          lede="Three rings: your account, the workspaces you manage, and each board."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-sm font-medium">Member</p>
              <p className="mt-1 text-sm text-pretty text-muted-foreground">
                The default. Full run of every board they can see — cards,
                comments, files, time.
              </p>
            </Card>

            <Card>
              <p className="text-sm font-medium">Workspace manager</p>
              <p className="mt-1 text-sm text-pretty text-muted-foreground">
                Runs one workspace: its name, its people, its invite links, its
                boards and who can see them — and can delete it. Whoever made a
                workspace is one.
              </p>
            </Card>

            <Card>
              <p className="text-sm font-medium">Administrator</p>
              <p className="mt-1 text-sm text-pretty text-muted-foreground">
                Manages every workspace they belong to, and alone can archive or
                delete a board, delete a task outright, or remove someone
                else&apos;s comment or file.
              </p>
            </Card>
          </div>

          <p className="text-sm text-pretty text-muted-foreground">
            Managers are chosen in{" "}
            <Link href="/settings" className="underline underline-offset-2">
              Settings
            </Link>{" "}
            → Permissions, and members who are one carry a Manager tag in the
            list. Whoever created a workspace always manages it, so it can never
            be left with nobody able to run it — and so can any administrator,
            so it cannot lock them out.
          </p>

          <Note title="People join by invite link">
            The members list shows this workspace and nobody else — it is a
            record of who is here, not a directory of everyone with an account.
            To bring somebody in, a manager sends them an invite link from
            Settings. Removing a member drops any management they had along with
            them.
          </Note>

          <Note title="A board can be narrower than its workspace">
            Boards are open to everyone in the workspace by default. Whoever
            manages the workspace can restrict editing to named people from the
            board toolbar&apos;s Permissions button, or make a board private. A
            private board is hidden from everyone else everywhere in the app
            rather than greyed out, so you will never be shown one you cannot
            open — including from a manager who was not given it.
          </Note>
        </Section>

        <Section
          id="board"
          icon={KanbanIcon}
          title="The board"
          lede="Cards move between columns. That is the whole model."
        >
          <Steps
            items={[
              "Add a card with the + at the foot of any column. A panel opens on the right, and a title is the only thing it asks for.",
              "Drag a card to another column to move it. The position is saved as soon as you let go.",
              "Drag a column by the handle to its left to reorder the board.",
              "Use the Filter button to narrow by priority, assignee or label. Filtering is instant — it never reloads the board.",
              "The gear beside the board's name holds the board itself: its name, icon and colour, and archiving it.",
            ]}
          />

          <Note title="One column means finished">
            Dropping a card into the column marked as done completes it, and
            dragging it back out reopens it. It is Done by default, but any
            column can be the one — open a column&apos;s menu and turn on
            &ldquo;Counts as done&rdquo;. This is also what fires the next
            occurrence of a repeating task.
          </Note>

          <p className="text-sm text-pretty text-muted-foreground">
            A column has to be empty before it can be deleted. Cards are never
            removed along with a column, because that is a lot of work to lose
            to one click.
          </p>
        </Section>

        <Section
          id="new-task"
          icon={PlusIcon}
          title="Adding a task"
          lede="One required field. The rest can wait — or be done now."
        >
          <p className="text-sm text-pretty text-muted-foreground">
            A title is all a task needs. Description, priority, assignee, start
            and due dates, an estimate, labels, a repeat and subtasks are all on
            the same panel, and all optional — fill in what you know and leave
            the rest.
          </p>

          <Card>
            <p className="text-sm font-medium">Subtasks, before the task exists</p>
            <p className="mt-1 text-sm text-pretty text-muted-foreground">
              Type a subtask, press <Key>Enter</Key>, type the next one. They
              are created along with the task, so a job whose shape you already
              know arrives whole instead of being assembled afterwards. Up to 20
              here; add as many more as you like later from the task itself.
            </p>
          </Card>

          <Note title="Creating leaves you on the board">
            The new card drops into its column and the panel closes. It does not
            then open the task — the panel you just filled in asked for
            everything the task panel would show, so there is nothing waiting
            behind it.
          </Note>
        </Section>

        <Section
          id="task"
          icon={CheckSquareIcon}
          title="Opening a task"
          lede="Clicking a card slides a panel in from the right. It is never a separate page."
        >
          <Card>
            <p className="text-sm text-pretty text-muted-foreground">
              The board stays behind the panel, so closing it always returns you
              exactly where you were. The address bar still carries the task, so
              you can copy the URL and send someone straight to a card.
            </p>
          </Card>

          <Note title="There is no Save button">
            Every field writes as you change it — the moment you pick a date,
            and the moment you click away from the title or description. A panel
            you can dismiss by clicking outside it must not be able to lose an
            edit.
          </Note>

          <p className="text-sm text-pretty text-muted-foreground">
            Under the assignee, <span className="font-medium text-foreground">
            Assigned by</span> shows who handed the task over. Reassigning it
            rewrites that to whoever made the change, so it always names the
            person behind the current assignment rather than the first one — and
            it reads &ldquo;Self-assigned&rdquo; when somebody picked up the work
            themselves.
          </p>
        </Section>

        <Section
          id="checklists"
          icon={CheckSquareIcon}
          title="Checklists and subtasks"
          lede="Both are in the panel, and they are not the same thing."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <p className="text-sm font-medium">Checklist</p>
              <p className="mt-1 text-sm text-pretty text-muted-foreground">
                A line of text and a tick. Use it for the steps of one job.
                Progress shows on the card as <span className="tabular-nums">2/5</span>.
              </p>
            </Card>

            <Card>
              <p className="text-sm font-medium">Subtask</p>
              <p className="mt-1 text-sm text-pretty text-muted-foreground">
                A real task with its own assignee, due date and priority — for
                work you need to hand to someone else.
              </p>
            </Card>
          </div>

          <p className="text-sm text-pretty text-muted-foreground">
            Subtasks never appear as cards on the board. They live in their
            parent&apos;s panel, which is what keeps a board readable when a
            single job has a dozen moving parts. They can be listed as the task
            is created as well as added to it later, and they stop at one level
            — a subtask cannot have subtasks of its own.
          </p>
        </Section>

        <Section
          id="repeat"
          icon={RepeatIcon}
          title="Repeating work"
          lede="Daily, weekly, monthly, quarterly, yearly, or specific weekdays."
        >
          <p className="text-sm text-pretty text-muted-foreground">
            Set a repeat from the panel&apos;s Repeat row. As you edit the rule
            it shows the next three dates it produces, so &ldquo;every 3 months
            on the 31st&rdquo; can be confirmed rather than guessed at.
          </p>

          <Note title="The next one appears when you finish this one">
            Completing a repeating task creates the next occurrence immediately
            — with the same description, labels, assignee and checklist, ticks
            cleared. Comments, files and logged time stay with the occurrence
            they belong to.
          </Note>

          <p className="text-sm text-pretty text-muted-foreground">
            If nobody completes it, the next one is created anyway once its date
            passes and someone opens the app. Leave a weekly task for six weeks
            and you get one card, not six — it catches up to the present rather
            than filling the board with history.
          </p>
        </Section>

        <Section
          id="views"
          icon={CalendarDaysIcon}
          title="Four views"
          lede="The same board, four shapes. Switching is instant."
        >
          <dl className="space-y-2.5">
            {[
              ["Board", "Columns and cards. The default."],
              ["List", "Dense rows grouped by column, with a tick box on each."],
              [
                "Calendar",
                "A month laid out by due date. Drag a card onto a day to reschedule it.",
              ],
              [
                "Timeline",
                "Bars from start date to due date. Give a task both to see it span.",
              ],
            ].map(([name, detail]) => (
              <div key={name} className="flex gap-3 text-sm">
                <dt className="w-20 shrink-0 font-medium">{name}</dt>
                <dd className="text-pretty text-muted-foreground">{detail}</dd>
              </div>
            ))}
          </dl>

          <p className="text-sm text-pretty text-muted-foreground">
            Nothing reloads when you switch, and your filters carry across. The
            view is in the address bar, so a link you send opens the way you
            were looking at it.
          </p>
        </Section>

        <Section
          id="files"
          icon={PaperclipIcon}
          title="Files and time"
          lede="Attachments stay private. Time is logged or timed."
        >
          <Card>
            <p className="flex items-center gap-2 text-sm font-medium">
              <PaperclipIcon className="size-4" aria-hidden="true" />
              Attachments
            </p>
            <p className="mt-1 text-sm text-pretty text-muted-foreground">
              Files are stored on your own database and served behind sign-in —
              a link to one is useless to anybody outside the workspace. Up to
              25 MB each.
            </p>
          </Card>

          <Card>
            <p className="flex items-center gap-2 text-sm font-medium">
              <TimerIcon className="size-4" aria-hidden="true" />
              Time
            </p>
            <p className="mt-1 text-sm text-pretty text-muted-foreground">
              Either start a timer and stop it later, or type what you spent —{" "}
              <span className="font-mono text-xs">45m</span>,{" "}
              <span className="font-mono text-xs">1h 30m</span> and{" "}
              <span className="font-mono text-xs">90</span> all work. Set an
              estimate to see a bar fill against it.
            </p>
          </Card>
        </Section>

        <Section
          id="search"
          icon={SearchIcon}
          title="Search"
          lede="One shortcut for finding anything and creating anything."
        >
          <p className="text-sm text-pretty text-muted-foreground">
            Press <Key>⌘</Key> <Key>K</Key> — or <Key>Ctrl</Key> <Key>K</Key> on
            Windows — anywhere in the app. It searches task titles and boards,
            jumps to any page, and creates a task — or a board, if you manage
            the workspace — without leaving the screen you are on.
          </p>

          <Note title="It only ever finds your own work">
            Results are scoped to the workspace you are in. There is no way to
            surface a task from a workspace you are not a member of, even by
            guessing at its name.
          </Note>
        </Section>

        <Section
          id="keyboard"
          icon={KeyboardIcon}
          title="Keyboard"
          lede="Including dragging, which does not need a mouse."
        >
          <Card>
            <p className="mb-2 text-sm font-medium">Anywhere</p>
            <div className="divide-y">
              <ShortcutRow keys={["⌘/Ctrl", "K"]} description="Open search" />
              <ShortcutRow keys={["Esc"]} description="Close a panel or dialog" />
              <ShortcutRow
                keys={["Tab"]}
                description="Skip to content, from the top of any page"
              />
            </div>
          </Card>

          <Card>
            <p className="mb-2 text-sm font-medium">On a card</p>
            <div className="divide-y">
              <ShortcutRow keys={["Enter"]} description="Open the task panel" />
              <ShortcutRow
                keys={["Space"]}
                description="Pick the card up, and put it down again"
              />
              <ShortcutRow
                keys={["↑ ↓ ← →"]}
                description="Move it while it is picked up"
              />
              <ShortcutRow
                keys={["Esc"]}
                description="Drop it back where it started"
              />
            </div>
          </Card>

          <Card>
            <p className="mb-2 text-sm font-medium">Typing</p>
            <div className="divide-y">
              <ShortcutRow
                keys={["Enter"]}
                description="Add the task, checklist item or subtask you are typing"
              />
              <ShortcutRow
                keys={["⌘/Ctrl", "Enter"]}
                description="Post a comment"
              />
              <ShortcutRow
                keys={["Shift", "Enter"]}
                description="New line instead, when writing to the assistant"
              />
              <ShortcutRow keys={["Esc"]} description="Discard what you typed" />
            </div>
          </Card>
        </Section>
      </FadeIn>
    </div>
  );
}
