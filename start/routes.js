module.exports = function ($route, $logger) {
    /** Register HTTP requests **/
    $route.get("/", "HomeController@welcome");
    $route.get("/tracking", "TrackingController@trackByCode");
    $route.get("/tracking/:code", "TrackingController@trackByCode");
    /** Register socket.io requests **/
    /** Register filters **/
};
