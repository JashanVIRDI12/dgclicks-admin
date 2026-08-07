/**
 * The shape of a person as every other module sees them.
 *
 * Assignees, comment authors, board members and activity actors all render the
 * same avatar and name, so they all take this rather than a module-local copy.
 * Deliberately excludes `role` — authorisation is decided on the server, and
 * shipping it to the browser invites a UI that trusts it.
 */
export type UserSummary = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};
