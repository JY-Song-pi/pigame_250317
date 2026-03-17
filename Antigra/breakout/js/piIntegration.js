/**
 * Pi Network SDK Integration Wrapper
 */
const PiIntegration = {
    isAuthenticated: false,
    user: null,

    async init() {
        try {
            if (typeof Pi === 'undefined') {
                console.warn('Pi SDK not loaded. Running in local test mode.');
                return false;
            }
            Pi.init({ version: "2.0", sandbox: true }); // Use Sandbox for testing
            console.log('Pi SDK Initialized');
            return true;
        } catch (error) {
            console.error("Pi init error:", error);
            return false;
        }
    },

    async authenticate(callbacks) {
        if (typeof Pi === 'undefined') {
            // Mock authentication for local development
            setTimeout(() => {
                this.isAuthenticated = true;
                this.user = { username: 'test_pioneer' };
                if(callbacks.onSuccess) callbacks.onSuccess(this.user);
            }, 500);
            return;
        }

        try {
            const scopes = ['username', 'payments'];
            const authResults = await Pi.authenticate(scopes, callbacks.onIncompletePaymentFound);
            this.isAuthenticated = true;
            this.user = authResults.user;
            console.log('User authenticated via Pi SDK:', this.user.username);
            if(callbacks.onSuccess) callbacks.onSuccess(this.user);
        } catch (error) {
            console.error("Pi auth error:", error);
            if(callbacks.onError) callbacks.onError(error);
        }
    },

    async requestPayment(memo, amount, callbacks) {
        if (typeof Pi === 'undefined') {
            // Mock payment
            console.log(`Mocking Pi Payment: ${amount} Pi for [${memo}]`);
            setTimeout(() => {
                if(callbacks.onReadyForServerApproval) callbacks.onReadyForServerApproval("test_payment_id");
                setTimeout(() => {
                    if(callbacks.onReadyForServerCompletion) callbacks.onReadyForServerCompletion("test_payment_id", "test_txid");
                }, 1000);
            }, 500);
            return;
        }

        try {
            const payment = await Pi.createPayment({
                amount: amount,
                memo: memo,
                metadata: { type: 'breakout_payment' },
            }, {
                onReadyForServerApproval: (paymentId) => {
                    if(callbacks.onReadyForServerApproval) callbacks.onReadyForServerApproval(paymentId);
                },
                onReadyForServerCompletion: (paymentId, txid) => {
                    if(callbacks.onReadyForServerCompletion) callbacks.onReadyForServerCompletion(paymentId, txid);
                },
                onCancel: (paymentId) => {
                    console.warn("Payment cancelled by user:", paymentId);
                    if(callbacks.onCancel) callbacks.onCancel(paymentId);
                },
                onError: (error, payment) => {
                    console.error("Payment error:", error, payment);
                    if(callbacks.onError) callbacks.onError(error);
                },
            });
        } catch (error) {
            console.error("Create payment exception:", error);
            if(callbacks.onError) callbacks.onError(error);
        }
    }
};

window.PiIntegration = PiIntegration;
