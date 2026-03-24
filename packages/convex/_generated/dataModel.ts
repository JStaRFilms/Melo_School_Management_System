export type Id<TableName extends string> = string & {
  readonly __tableName?: TableName;
};

export type DataModel = any;
