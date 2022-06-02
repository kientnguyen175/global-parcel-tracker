module.exports = HomeController;

function HomeController($config, $event, $logger) {
    this.welcome = async function (io) {
        io.echo('Parcel Tracker Puppeteer');
    }
}
