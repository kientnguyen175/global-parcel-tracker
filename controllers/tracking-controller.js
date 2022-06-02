module.exports = TrackingController;
const fs = require('fs-extra');
const puppeteer = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');
const adblockerPlugin = require('puppeteer-extra-plugin-adblocker');
puppeteer.use(stealthPlugin());
puppeteer.use(adblockerPlugin({ blockTrackers: true }));

function TrackingController($config, $event, $logger) {
    var self = this;

    this.trackByCode = async function(io) {
        var retval = {};
        var chromeTmpDataDir = null;
        if (io.inputs['code']) {
            const code = io.inputs['code'].toUpperCase();
            var url = null;
            if (io.inputs['url']) {
                url = self.buildUrl(code, io.inputs['url']);
            } else {
                url = `https://t.17track.net/en#nums=${ code }`;
            }
            const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';

            const browser = await puppeteer.launch({
                headless: true,
                ignoreHTTPSErrors: true, 
                dumpio: false,
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    '--ignore-certificate-errors', 
                    '--enable-features=NetworkService'
                ]
            });
            let chromeSpawnArgs = browser.process().spawnargs;
            for (let i = 0; i < chromeSpawnArgs.length; i++) {
                if (chromeSpawnArgs[i].indexOf("--user-data-dir=") === 0) {
                    chromeTmpDataDir = chromeSpawnArgs[i].replace("--user-data-dir=", "");
                }
            }

            const page = await browser.newPage();
            await page.setJavaScriptEnabled(true);
            await page.setDefaultNavigationTimeout(0); 
            await page.setUserAgent(userAgent);
            await page.goto(url);
            try {
                await page.waitForSelector(`#tn-${code}`);
                await page.waitForFunction(`document.getElementById('tn-${code}').getElementsByClassName('text-capitalize')[0].textContent != 'Tracking'`);
                retval = await self.getParcelStatus(page, code);
            } catch (error) {
                retval.message = "error";
            }
            retval.code = code;
            retval.url = io.inputs['url'] ? io.inputs['url'] : '';
            retval.buildedUrl = url;
            self.log(retval);
            await page.close();
            await browser.close();

            if (chromeTmpDataDir !== null) {
                fs.removeSync(chromeTmpDataDir);
            }
        }

        io.json(retval);
    }

    this.log = function (data) {
        let today = new Date();
        let d = today.getDate();
        let m = today.getMonth() + 1; 
        let Y = today.getFullYear();
        let H = today.getHours();
        let i = today.getMinutes();
        let s = today.getSeconds();
        if (d < 10) {
            d = `0${d}`;
        } 
        if (m < 10) {
            m = `0${m}`;
        } 
        if (H < 10) {
            H = `0${H}`;
        }
        if (i < 10) {
            i = `0${i}`;
        }
        if (s < 10) {
            s = `0${s}`;
        }

        $logger.info("----------------------------------------------------------------------");
        $logger.info(`[${d}-${m}-${Y} ${H}:${i}:${s}]` + ' tracking: ' + JSON.stringify(data));
    }

    this.buildUrl = function (code, rawUrl) {
        var retval = `https://t.17track.net/en#nums=${ code }`;

        var domainParts = rawUrl.split('/');
        if (domainParts.length >= 3) {
            var domain = domainParts[2];
            domain = domain.replaceAll('.', '_').replaceAll('-', '_');
            isSpecicalCarrier = $config.get('carriers.special_carriers')[domain];
            if (isSpecicalCarrier) {
                first2CharactersOfCode = code.substring(0, 2);
                isSpecicalCode = $config.get(`${ isSpecicalCarrier }.fc`)[first2CharactersOfCode];
                if (isSpecicalCode) {
                    retval = `https://t.17track.net/en#nums=${ code }&fc=${ isSpecicalCode }`;
                }
            } else {
                var fc = $config.get('carriers.fc')[domain];
                if (fc) {
                    retval = `https://t.17track.net/en#nums=${ code }&fc=${ fc }`;
                }
            }
        }

        return retval;
    }

    this.getParcelStatus = async function(page, code) {
        var retval = {};

        var isBlocked = await page.$('#yq-modal-verification');
        var isMultiCarriers = await page.$('.yqcr-multi');
        if (isBlocked) { // blocked
            retval.message = 'blocked';
        } else if (isMultiCarriers) { // multi carriers
            var carrier = await page.$$('.yqc-item');
            await carrier[1].click();
            retval = await self.getStatusFromPage(page, code);
        } else { // single carrier
            retval = await self.getStatusFromPage(page, code);
        }

        return retval;
    }

    this.waitForStatusDisplayed = async function(page, code) {
        await page.waitForSelector(`#tn-${code}`);
        await page.waitForFunction(`document.getElementById('tn-${code}').getElementsByClassName('text-capitalize')[0].textContent != 'Tracking'`);
    }

    this.getRawStatus = async function(page, code) {
        retval = null;

        var rawStatusElement = await page.$(`#tn-${code} p.text-capitalize`);
        var retval = await page.evaluate(el => el.textContent, rawStatusElement);

        return retval;
    }

    this.handleRawStatus = function(rawStatus) {
        let retval = rawStatus;

        if (rawStatus.indexOf("Delivered") === 0) {
            retval = 'Delivered';
        }

        return retval;
    }

    this.getStatusFromPage = async function(page, code) {
        var retval = {};

        await self.waitForStatusDisplayed(page, code);
        retval.rawStatus = await self.getRawStatus(page, code);
        retval.status = self.handleRawStatus(retval.rawStatus);

        return retval;
    }
}
