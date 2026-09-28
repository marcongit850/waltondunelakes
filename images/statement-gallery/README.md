# Adding a homepage photo

These pictures appear beside “One of Florida’s most unusual natural systems.”

1. Drop a new photo in this folder. Use a jpg, png, or webp file.
2. Open `gallery.json` and add the filename to the list, in the order it should appear.
3. Commit and push, or ask Bob.

With one photo, the side arrows stay hidden. They show once the list has two or more names.

A filename on its own is enough. You can also add a short description so the photo still makes sense for someone who cannot see it:

```json
[
  {
    "file": "western-bridge.jpg",
    "alt": "County Road 30A crossing Western Lake, with coastal dunes beyond"
  },
  "my-new-photo.jpg"
]
```
