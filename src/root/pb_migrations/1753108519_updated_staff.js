/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2301119865")

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "file2170006031",
    "maxSelect": 1,
    "maxSize": 0,
    "mimeTypes": [],
    "name": "profile",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": [],
    "type": "file"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2301119865")

  // remove field
  collection.fields.removeById("file2170006031")

  return app.save(collection)
})
