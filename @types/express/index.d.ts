declare namespace Express {
  // Express decided they wanted to force a User interface,
  // making it impossible to dynamically extend the type in Request.user
  //
  // `id` is `number` because what this app actually attaches to `req.user` is
  // the `User` entity, whose `id` comes from `BaseEntity` and is the integer
  // primary key. Declaring it as `string` here made every `done(null, user)`
  // in the passport strategies a type error once `@types/passport-*` was
  // installed (finding `TS1`).
  interface User {
    id: number;
  }
}
