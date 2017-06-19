(function($, _, PouchDB) {

    $(function() {
        var app = new App;

        app.initialize();
    });


    function App() {}

    App.db = {};
    App.remoteFiles = ['pics/pic0.png', 'pics/pic1.png', 'pics/pic2.png', 'pics/pic3.png'];
    App.config = {};
    App.newFiles = [];
    App.dt = 0;


    App.prototype.initialize = function() {
        App.db = new PouchDB('my_database', {});
        App.timestamp = new Date().valueOf();

        dlog('PouchDB adapter:', App.db.adapter);

        App.loadConfig()
            .then(function() {
                dlog('Cached images: ' + App.config.filelist.length)
            })
            .then(App.getFilesModifiedDate)
            .then(App.checkModifiedFiles)
            .then(App.grabNewFiles)
            .then(App.saveNewFiles)
            .then(App.loadConfig)
            .then(App.renderImages)
            .then(function() {
                console.log('7.Done.');
                dlog('Updated: ' + App.newFiles.length);
            });

    }

    App.getDb = function() {
        return App.db.get('config', { "attachments": true }).catch(function(err) {
            console.log('Config not found. First launch', err);
            dlog('First launch');

            return App.db.put({ '_id': "config", 'filelist': [] }).then(function(resp) {
                console.log('Creating new config');
                if (resp.ok) {
                    return App.getDb();
                }
            });

        });
    }


    App.loadConfig = function() {
        return App.getDb().then(function(doc) {
            App.config = doc;
            console.log('Config loaded', App.config);

            return doc;
        });
    }


    App.getFilesModifiedDate = function() {
        console.log('Get Modified Date')

        return Promise.all(App.remoteFiles.map(getModifiedDate));
    }

    App.checkModifiedFiles = function(files) {
        console.log('3.Check for modified files')

        return new Promise(function(resolve, reject) {
            var newFiles = [];

            for (var i in files) {
                var file = files[i];

                var elem = _.findWhere(App.config.filelist, { 'url': file.url });
                if (elem != undefined) {
                    if (file.modified > elem.modified) {
                        elem.modified = file.modified;
                        newFiles.push(file);
                    }
                } else {
                    newFiles.push(file);
                }
            }
            App.newFiles = newFiles;
            resolve();
        });
    }


    App.grabNewFiles = function() {
        console.log('4.Grab modified files', App.newFiles);

        return new Promise(function(resolve, reject) {
            return Promise.all(App.newFiles.map(getImageAsBlob)).catch(function(err) {
                console.log('problem', err);
            }).then(function(images) {
                console.log(images);
                resolve();
            });
        });

    }



    App.saveNewFiles = function() {
        return new Promise(function(resolve, reject) {
            var newFiles = App.newFiles;
            console.log('5. Saving images', newFiles);
            if (!newFiles.length) {
                console.log('No modified files. Skip saving');
                resolve();
            }

            App.getDb().then(function(doc) {
                var attachmentsObj = {};
                if (doc._attachments) {
                    attachmentsObj = doc._attachments;
                }

                for (var i in newFiles) {
                    var image = newFiles[i];

                }
                newFiles.map(function(newFile) {

                    attachmentsObj[newFile.url] = { 'content_type': 'image/png', 'data': newFile.blob };

                    delete newFile.blob;

                    var el = _.findWhere(doc.filelist, { url: newFile.url });
                    if (el != undefined) {
                        el.modified = newFile.modified;
                    } else {
                        doc.filelist.push(newFile);
                    }
                });
                doc._attachments = attachmentsObj;
                App.db.put(doc).catch(function(err) {
                    reject(err)
                }).then(function() {
                    resolve();
                });

            });
        });

    }

    App.renderImage = function(el) {
        return new Promise(function(resolve, reject) {
            App.db.getAttachment("config", el.url, { rev: el._rev }).then(function(attach) {
                var blob = attach;
                var src = "";
                if ({}.toString.apply(blob) === '[object Blob]') {
                    src = window.URL.createObjectURL(blob);
                } else {
                    var binaryData = [];
                    binaryData.push(blob);
                    src = window.URL.createObjectURL(new Blob(binaryData, { type: 'image/png' }));
                }

                var image = new Image();
                image.onload = function() {
                    console.log('img onload ' + el.url);

                    resolve();
                }
                image.src = src;

                var div = document.createElement('div');
                div.className = 'img';
                div.appendChild(image);
                if (_.findWhere(App.newFiles, { url: el.url }) != undefined) {
                    div.className += ' updated';
                }

                document.querySelector('#main').appendChild(div);
            });

        });


    }

    App.renderImages = function() {
        console.log('6.Rendering images');

        return Promise.all(App.config.filelist.map(App.renderImage));
    }

    App.clearDb = function() {

        return App.db.destroy().then(function() {
            document.location.reload()
        });
    }

    function updatePicOnServer() {
        dlog('updating pic on server...');
        get('update.php').then(function() {
            dlog('updated. reloading');

            setTimeout(function() {
                document.location.reload();
            }, 250)

        }).catch(function(err) {
            console.error(err);
        });
    }

    function getModifiedDate(url) {
        return new Promise(function(resolve, reject) {
            var req = new XMLHttpRequest();

            req.open("HEAD", url + '?t=' + App.timestamp);

            req.onload = function() {
                if (req.status == 200) {
                    resolve({ url: url, modified: Date.parse(req.getResponseHeader('Last-Modified')) });
                } else {
                    reject(Error(req.statusText));
                }
            };

            req.onerror = function() {
                reject(Error("Network Error"));
            };

            req.send(null);

        }).catch(function(err) {
            if (err.message == 'Not Found') {
                return 0;
            }
            console.log('123');
            console.log(err);
        });
    }


    function get(url) {
        var binary = false;
        if (arguments.length > 1 && arguments[0]) {
            var binary = true;
        }

        return new Promise(function(resolve, reject) {
            var req = new XMLHttpRequest();
            req.open('GET', url + '?t=' + App.timestamp);

            if (binary) {
                req.responseType = "blob";
            }

            req.onload = function() {
                if (req.status == 200) {
                    resolve(req.response);
                } else {
                    reject(Error(req.statusText));
                }
            };

            req.onerror = function() {
                reject(Error("Network Error"));
            };

            req.send();
        });
    }

    function getJson(url) {
        return get(url).then(JSON.parse);
    }

    /**
     * @param file Object {url: fileUrl}
     *
     */
    function getImageAsBlob(file) {
        console.log('Grab image', file);

        return get(file.url, true).then(function(blob) {
            file.blob = blob;
            return file;
        });
    }

    window.updatePicOnServer = updatePicOnServer;
    window.clearDb = App.clearDb;

})(jQuery, _, PouchDB);