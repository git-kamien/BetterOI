import { openDB, DBSchema } from "idb";

module History_Module {
  export module typings {
    export type Entry = {
      snapshot: {[x: string]: any},
      query: string,
      tid?: string,
    };
    export interface Schema extends DBSchema {
      archive: {
        indexes: {
          by_query: string,
          by_tid: string,
        },
        value: Entry,
        key: string,
      },
    };
  };
  export module methods {
    export async function open_history_db() {
      const database = await openDB<typings.Schema>("osint_history", 1, {
        upgrade(db) {
          const store = db.createObjectStore("archive", {
            keyPath: "tid",
          });
          store.createIndex("by_query", "query");
          store.createIndex("by_tid", "tid");
        },
      });
      return database;
    };
    export async function archive_snapshot(value: typings.Entry) {
      const database = await open_history_db();
      const tid: string = new Date().getTime().toString(16);
      return database.add("archive", {
        ...value,
        tid,
      });
    };
    export async function query_snapshots(target_query: string) {
      const database = await open_history_db();
      const snapshots = await database.getAllFromIndex("archive", "by_query", target_query);
      return snapshots.sort((a: typings.Entry, b: typings.Entry) => {
        const a_date = new Date(+`0x${a.tid}`);
        const b_date = new Date(+`0x${b.tid}`);

        return Number(b_date) - Number(a_date);
      });
    };
    export async function query_snapshot(target_tid: string) {
      const database = await open_history_db();
      return await database.getFromIndex("archive", "by_tid", target_tid);
    };
  };
};

export {
  History_Module
};

