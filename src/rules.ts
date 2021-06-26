import { Config } from "./board";
import { getTagId, UpdateQuery, resolveNotebookPath } from "./noteData";

export interface Rule {
  searchQueries: string[];
  set(noteId: string): UpdateQuery[];
  unset(noteId: string): UpdateQuery[];
}

export type RuleFactory = (
  ruleValue: string | string[],
  config: Config
) => Promise<Rule>;

type Rules = { [ruleName: string]: RuleFactory };

const rules: Rules = {
  async tag(tagName: string | string[]) {
    if (Array.isArray(tagName)) tagName = tagName[0];
    const tagID = await getTagId(tagName);
    return {
      searchQueries: [`tag:${tagName}`],
      set: (noteId: string) => [
        {
          type: "post",
          path: ["tags", tagID, "notes"],
          body: { id: noteId },
        },
      ],
      unset: (noteId: string) => [
        {
          type: "delete",
          path: ["tags", tagID, "notes", noteId],
        },
      ],
    };
  },

  async tags(tagNames: string | string[], config: Config) {
    if (!Array.isArray(tagNames)) tagNames = [tagNames];
    const tagRules = await Promise.all(
      tagNames.map((t) => rules.tag(t, config))
    );
    return {
      searchQueries: tagRules.flatMap(({ searchQueries }) => searchQueries),
      set: (noteId: string) => tagRules.flatMap(({ set }) => set(noteId)),
      unset: (noteId: string) => tagRules.flatMap(({ unset }) => unset(noteId)),
    };
  },

  async notebookPath(path: string | string[], config: Config) {
    if (Array.isArray(path)) path = path[0];
    const notebookId = await resolveNotebookPath(
      path,
      config.filters.rootNotebookPath
    );
    const notebook = path.split("/").pop();
    return {
      searchQueries: [`notebook:"${notebook}"`],
      set: (noteId: string) => [
        {
          type: "put",
          path: ["notes", noteId],
          body: {
            parent_id: notebookId,
          },
        },
      ],
      unset: () => [],
    };
  },

  async completed(val: string | string[]) {
    if (Array.isArray(val)) val = val[0];
    const shouldBeCompeted = val.toLowerCase() === "true";
    return {
      searchQueries: [`iscompleted:${shouldBeCompeted ? 1 : 0}`],
      set: (noteId: string) => [
        {
          type: "put",
          path: ["notes", noteId],
          body: {
            completed: shouldBeCompeted ? Date.now() : 0,
          },
        },
      ],
      unset: (noteId: string) => [
        {
          type: "put",
          path: ["notes", noteId],
          body: {
            completed: 0,
          },
        },
      ],
    };
  },
};

export default rules;
