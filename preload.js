const https = require('https');
const fs = require('fs');


var data, displayCards, fn;
/*
    Description: This program downloads/saves a bulk data file from Scryfall's api and then sorts/displays the data based on card prices.
    Author: Miles Wilkins
    Last edited: 6/24/2021
*/
window.addEventListener('DOMContentLoaded', () => {
    var obj, uri, cardsData;
    var images = [];
    var pageRange = 0;

    getBulkDataFile().then(() => {
        createHtml(fn).then(() => {
            //Create eventlisteners for button presses
            document.getElementById("prevBtn").addEventListener("click", () => {
                pageRange -= 8;
                let min = pageRange;
                let max = pageRange + 8;
                let cardId = 0;
                if (pageRange < 0) {
                    pageRange = 0;
                }
                else if (min < 0) {
                    min = 0;
                    max = 8;
                    for (let x = min; x < max; x++) {
                        updateHtml(displayCards[x], cardId);
                        cardId++;
                    }
                }
                else {
                    for (let x = min; x < max; x++) {
                        updateHtml(displayCards[x], cardId);
                        cardId++;
                    }
                }
            })
            // Next button event listener
            document.getElementById("nextBtn").addEventListener("click", () => {
                pageRange += 8;
                let min = pageRange;
                let max = pageRange + 8;

                getCards(displayCards, min, max);
            })
        })
    });
})

/* 
    * Params: 
    * Checks if bulk data file already exists, if not then downloads it. 
*/
async function getBulkDataFile() {
    return new Promise(resolve => {
        //creates a unique filename for bulkdata based on current date
        var current_date = new Date;
        var url_date = (current_date.getMonth().toString() + 1) + (current_date.getDay().toString() + 1) + (current_date.getFullYear().toString());
        let fileName = "Scryfall_Bulkdata_" + url_date + ".json";

        deleteOldFiles(fileName);

        const download_uri = {
            hostname: 'api.scryfall.com',
            path: '/bulk-data',
            method: 'GET'
        }

        //gets and makes request to scryfall api to extract download url if file does not already exist
        if (!fs.existsSync(fileName)) {
            makeRequest(download_uri).then(() => {
                data = JSON.parse(data);
                let uriLength = data.data[0].download_uri.length;
                var uri_path = data.data[0].download_uri.toString().slice(23, uriLength);

                //creates path for download url
                let options = {
                    hostname: 'c2.scryfall.com',
                    path: uri_path,
                    method: 'GET'
                }
                makeRequest(options).then(() => {
                    fs.writeFile(fileName, data, (err) => {
                        if (err) {
                            console.error(err);
                            return;
                        }
                    });
                    fn = fileName;
                    resolve();
                })
            })
        }
        else {
            fn = fileName;
            resolve();
        }
    })
}
/* 
    * Params: fileName (string)
    * iterates through files in current directory looking for previous bulkdata files. if found deletes them.
*/
function deleteOldFiles(fileName) {
    //Checks for old bulkdata files 
    fs.readdir(__dirname, (err, files) => {
        files.forEach(file => {
            if (file.includes("Scryfall_Bulkdata")) {
                if (file != fileName) {
                    // delete file
                    fs.unlink(file, (err) => {
                        if (err) {
                            console.log(err);
                        }
                    });
                }
            }
        })
    })
}
/*
    params: options is an object containing connection data (hostname, path, method)
    function to make requests to the specified server
*/
function makeRequest(options) {
    return new Promise(resolve => {

        callback = function (response, err) {
            data = '';
            if (err) {
                console.log(err);
            }
            response.on('data', (d) => {
                data += d;
            });

            response.on('end', () => {
                resolve(data);
            });
        }
        let request = https.request(options, callback);
        request.on('error', (e) => {
            console.log("Timed out failure");
            makeRequest(options);
        })
        request.end();



    })
}

/* 
    * Params: url (string), path (string)
    * Checks if image exists and if size is > 0. if not then invokes and awaits getImage function
*/
async function downloadImages(url, path) {
    try {
        if (fs.existsSync(path)) {
            let file = fs.statSync(path);
            let size = file.size;
            if (size > 0) {
                return;
            }
            else {
                await getImage(url, path);
                return;
            }
        }
        else {
            await getImage(url, path);
            return;
        }
    }
    catch (err) {
        console.log(err);
        return false;
    }
}

/* 
    * Params: fn (string)
    * Invokes and awaits the getFile() function to retrieve data from bulk data file, iterates through the data pulling and placing the 
    * card's name, usd price, euro price, both foil prices, image .png download url, regular and foil price differences, and a filename for the image
    * in a new object array. Then it calls purgeNull() to remove objects with prices as 0, and finally returns a sorted array.
*/
async function getData(fn) {
    let bulkData = await getFile(fn);
    let cards = [];
    return new Promise(resolve => {
        for (let x = 0; x < bulkData.length; x++) {
            let temp = {};
            let diff, foilDiff, image_path;
            let image_uri = '';
            let name = bulkData[x].name;
            let usd = bulkData[x].prices.usd;
            let eur = bulkData[x].prices.eur;
            let usdFoil = bulkData[x].prices.usd_foil;
            let eurFoil = bulkData[x].prices.eur_foil;

            try {
                if (bulkData[x].image_uris.png === undefined) {
                    image_uri = "none";
                }
                else {
                    image_uri = bulkData[x].image_uris.png;
                }
                if (usd === null) {
                    usd = '0';
                }
                else if (eur === null) {
                    eur = '0';
                }
                else if (usdFoil === null) {
                    usdFoil = '0';
                }
                else if (eurFoil === null) {
                    eurFoil = '0';
                }
            }
            catch (error) {
                console.log(error);
                image_uri = "none";
            }
            //replace spaces with '-' and '//' with 'or'
            name = name.split(" ").join("-");
            name = name.replace(/\/\//g, "or").replace(/"/g, '');
            if (image_uri === undefined || image_uri == "none") {
                image_path = "images/nopng.png";
            }
            else {
                image_path = "./images/" + name + ".png";
            }

            diff = usd - eur;
            foilDiff = usdFoil - eurFoil;
            temp = { 'name': name, 'usd': usd, 'eur': eur, 'usdFoil': usdFoil, 'eurFoil': eurFoil, "diff": diff, 'foilDiff': foilDiff, "path": image_path, "img_uri": image_uri };
            cards.push(temp);
        }
        let sortedCards = purgeNull(cards);
        return resolve(sortedCards);
    })

}

/* 
    *Params: cards (object array)
    *sorts the given object array based on the difference value and then removes objects with any non-foil prices as zero
*/
function purgeNull(cards) {
    cards.sort((a, b) => (a.diff > b.diff) ? 1 : -1);
    for (let x = 0; x < cards.length; x++) {
        if (cards[x].usd == '0' || cards[x].eur == '0')
            cards.splice(x, 1);
    }
    return cards;
}

/* 
    * Params: path (string)
    * reads and retrieves data from a file and returns it as an object array
*/
async function getFile(path) {
    return new Promise(resolve => {
        let obj;
        fs.readFile(path, 'utf8', (err, data) => {
            if (err) {
                console.error(err)
            }
            obj = JSON.parse(data);
            return resolve(obj);
        });
    });
}

/* 
    * Params: fn (string)
    * Creates the html for card objects then creates eventListeners for their <img> tags. Finally calls getInitialCards() to download images
    * and set the first page of cards.
*/
async function createHtml(fn) {
    let cards = await getData(fn);
    let imagesReady = false;

    return new Promise(resolve => {
        displayCards = cards;
        var html = '';
        let counter = 0;
        let baseRow = document.createElement("div");

        for (let x = 0; x < 2; x++) { // creates rows
            baseRow.className = "row card-block";
            document.getElementById("cardsContainer").appendChild(baseRow);

            for (let i = 0; i < 4; i++) { //creates card objects

                let image_path = cards[counter].path;

                let rowDiv = document.createElement("div");
                rowDiv.className = "col-sm-3";

                let cardDiv = document.createElement("div");
                cardDiv.className = "card";
                cardDiv.id = "card" + counter;

                let cardImg = document.createElement("img");
                cardImg.className = "card-img-top";
                cardImg.id = "card" + counter + "img";

                let cardH5 = document.createElement("h5");
                cardH5.style = "text-align:center;";
                cardH5.id = "card" + counter + "name";
                cardH5.innerHTML = cards[counter].name.split("-").join(" ");

                let cardBody = document.createElement("div");
                cardBody.className = "card-body";


                let cardText = document.createElement("p");
                cardText.className = "card-text";
                cardText.id = "card" + counter + "text";
                cardText.innerHTML = 'Usd: $' + cards[counter].usd + '<br>Euro: \u20ac' + cards[counter].eur + '<br>Usd Foil: $' + cards[counter].usdFoil +
                    '<br>Euro Foil: \u20ac' + cards[counter].eurFoil + '<br>diff: ' + cards[counter].diff.toFixed(2) + '<br>Foil Diff: ' + cards[counter].foilDiff.toFixed(2);

                cardBody.append(cardText);
                cardDiv.append(cardImg, cardH5, cardBody);
                rowDiv.append(cardDiv);
                baseRow.append(rowDiv);

                counter++;
            }
        }
        document.getElementById("cardsContainer").append(baseRow);

        for (let a = 0; a < 8; a++) {
            let nameId = "card" + a + "name";
            let textId = "card" + a + "text";
            let imgId = "card" + a + "img";
            document.getElementById(imgId).addEventListener("load", () => {

                let imgSrc = document.getElementById(imgId).getAttribute("src");
                let index = displayCards.findIndex(obj => obj.path == imgSrc);
                let card = displayCards[index];

                document.getElementById(nameId).innerHTML = card.name;
                document.getElementById(textId).innerHTML = 'Usd: $' + card.usd + '<br>Euro: \u20ac' + card.eur + '<br>Usd Foil: $' + card.usdFoil +
                    '<br>Euro Foil: \u20ac' + card.eurFoil + '<br>diff: ' + card.diff.toFixed(2) + '<br>Foil Diff: ' + card.foilDiff.toFixed(2);
            })
        }

        getInitialCards(cards, 0, 8);
        resolve();
    })
}

/* 
    * Params: card (object), id (int)
    * Changes the src value of a given card to prompt the eventListener to update the given card
*/
function updateHtml(card, id) {
    let imgId = "card" + id + "img";

    document.getElementById(imgId).src = card.path;
}

/* 
    * Params: url (string), path (string)
    * Uses the url param to download a PNG image to file named after path param
*/
async function getImage(url, path) {
    return new Promise(resolve => {
        let host = url.slice(8, 23);
        let uri_path = url.slice(23, url.length);
        var file = fs.createWriteStream(path);
        if (url == "none") {
            return;
        }

        let options1 = {
            hostname: host,
            path: uri_path,
            method: 'GET'
        };

        let request = https.request(options1, (req) => {

            let stream = req.pipe(file);
            stream.on('finish', () => {
                stream.end();
            });



        });
        request.end();
        return resolve;
    })

}

/* 
    * Params: cards (object array), min (int), max (int)
    * calls updateHtml() to get next page of cards and then downloads the images of the page after
*/
async function getCards(cards, min, max) {
    let id = 0;
    for (let a = min; a < max; a++) {
        updateHtml(cards[a], id);
        id++;
    }

    min += 8;
    max += 8;
    for (let x = min; x < max; x++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        await new Promise(next => {
            downloadImages(cards[x].img_uri, cards[x].path);
            next()
        })
    }

}

/* 
        * Params: cards (object array), min (int), max (int)
        * Called in createHtml().
        
        1. Downloads the first page of images
        2. updates the HTML using updateHtml()
        3. Downloads the second page of images
    */
async function getInitialCards(cards, min, max) {
    
    let id = 0;
    // 1
    for (let x = min; x < max; x++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        await new Promise(next => {
            downloadImages(cards[x].img_uri, cards[x].path);
            next()
        })
    }
    // 2
    for (let i = min; i < max; i++) {
        updateHtml(cards[i], id);
        id++;
    }
    // 3
    min += 8;
    max += 8;
    for (let x = min; x < max; x++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        await new Promise(next => {
            downloadImages(cards[x].img_uri, cards[x].path);
            next()
        })
    }
}