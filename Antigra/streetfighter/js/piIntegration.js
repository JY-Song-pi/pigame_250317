/**
 * piIntegration.js
 * Handles Pi Network SDK integration
 */

const PiIntegration = (() => {
    let sessionPi = 0;

    function init() {
        try {
            if (window.Pi) {
                window.Pi.init({ version: "1.5", sandbox: true });
                console.log("Pi SDK Initialized");
            }
        } catch (e) {
            console.error("Pi SDK Init Error:", e);
        }
    }

    function getSessionPi() { return sessionPi; }
    function addPiReward(amt) {
        sessionPi += amt;
        return sessionPi;
    }

    return { init, getSessionPi, addPiReward };
})();
