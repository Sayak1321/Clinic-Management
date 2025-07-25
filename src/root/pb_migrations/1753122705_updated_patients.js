/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1820489269")

  // update field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "select3343321666",
    "maxSelect": 1,
    "name": "gender",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "Male",
      "Female",
      "Others"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1820489269")

  // update field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "select3343321666",
    "maxSelect": 1,
    "name": "gender",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "male",
      "female",
      "non binary"
    ]
  }))

  return app.save(collection)
})
