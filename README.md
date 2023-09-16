# BetterOI

BetterOI is a browser extension designed to enhance the user experience of the search engine interface for [OSINT Industries](https://osint.industries/).

**Key Features:**
* View results directly in JSON format
* Maintain a comprehensive local history of snapshots using the IndexedDB API

**Requirements:**
* Tampermonkey is available on most popular browsers:
  - [Google Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
  - [Mozilla Firefox](https://addons.mozilla.org/pl/firefox/addon/tampermonkey/)
  - [Opera](https://addons.opera.com/pl/extensions/details/tampermonkey-beta/)

**Installation without building (FAST):**
* 1.) Install the already builded script from: [BetterOI.user.js](https://github.com/git-kamien/BetterOI/raw/master/release/BetterOI.user.js)
* 2.) Enter the [OSINT Industries](https://osint.industries/) website and have fun

**Installation with building (SLOW):**
* 1.) Clone the repository
```sh
git clone https://github.com/git-kamien/BetterOI
```
* 2.) Navigate to the cloned repository and install the required dependencies
```sh
cd BetterOI && npm install
```
* 3.) Build the extension
```sh
npm run build
```
* 4.) Go to the `./release/` and copy content of file `BetterOI.user.js`
* 5.) Insert the copied content into a new Tampermonkey script
* 6.) Enter the [OSINT Industries](https://osint.industries/) website and have fun
