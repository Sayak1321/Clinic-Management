/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3912360763")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != \"\" ",
    "deleteRule": "@request.auth.id = patient.id",
    "listRule": "@request.auth.id = patient.id",
    "updateRule": "@request.auth.id = patient.id",
    "viewRule": "@request.auth.id = patient.id"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3912360763")

  // update collection data
  unmarshal({
    "createRule": null,
    "deleteRule": null,
    "listRule": null,
    "updateRule": null,
    "viewRule": null
  }, collection)

  return app.save(collection)
})
