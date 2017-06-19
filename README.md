Storing images at client side in PouchDB
=======================================================

This PoC downloads some images from server, store it at client side, using PouchDB, and renders it as Blobs.
After each run app sends HEAD query and checks Last-Modified date of files. If file were updated - app downloads new version from server and updates images locally. If no updates available - it renders it from local database.

Works on: Chrome, Firefox, Opera, IE 11, Android Chrome, iOS Safari  

[Live example](http://178.212.199.69) 

I used nginx and PHP to run update.php - it updates pics/pic0.png image.
