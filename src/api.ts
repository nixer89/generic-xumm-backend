import * as Xumm from './xumm';
import * as Db from './db';
import * as Special from './special';
import * as config from './util/config';
import consoleStamp = require("console-stamp");
import { XummTypes } from 'xumm-sdk';
import DeviceDetector = require("device-detector-js");
import { GenericBackendPostRequestOptions, TransactionValidation } from './util/types';

consoleStamp(console, { pattern: 'yyyy-mm-dd HH:MM:ss' });

let xummBackend = new Xumm.Xumm();
let db = new Db.DB();
let special = new Special.Special();
let deviceDetector = new DeviceDetector();

export async function registerRoutes(fastify, opts, next) {
    await xummBackend.init();
    await db.initDb("api");
    await special.init();
    
    fastify.post('/api/v1/platform/payload', async (request, reply) => {
        console.log("post payload headers: " + JSON.stringify(request.headers));
        //console.log("body: " + JSON.stringify(request.body));
        if(!request.body.payload)
            reply.code(500).send('Please provide a xumm payload. Calls without xumm payload are not allowed');
        else {
            //try parsing the user agent when unknown to determine if web or app
            try {
                try {
                    if(request.body && request.body.options && (request.body.options.web == null || request.body.options.web == undefined)) {
                        let parseResult = deviceDetector.parse(request.headers['user-agent'])
                        if(parseResult && parseResult.device && parseResult.device.type) {
                            request.body.options.web = 'desktop' === parseResult.device.type;
                        }
                    }
                } catch(err) {
                    console.log("failed to parse user agent");
                    console.log(JSON.stringify(err));
                }

                let payloadResponse = await xummBackend.submitPayload(request.body.payload, request.headers.origin, request.headers.referer, request.body.options);
                return payloadResponse;
            } catch (err) {
                if('bithomp' == err) {
                    return { success : false, error: true, message: "We can not contact our XRP Ledger service provider and therefore won't be able to to verify your transaction. Please try again later!"};
                }
                else
                    return { success : false, error: true, message: 'Something went wrong. Please check your request'};
                }
        }
    });

    fastify.get('/api/v1/platform/payload/:id', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        if(!request.params.id) {
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        } else {
            try {
                return xummBackend.getPayloadInfoByOrigin(request.headers.origin, request.params.id);
            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/platform/payload/ci/:custom_identifier', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        if(!request.params.custom_identifier) {
            reply.code(500).send('Please provide a custom_identifier. Calls without custom_identifier are not allowed');
        } else {
            try {
                return xummBackend.getPayloadForCustomIdentifierByOrigin(request.headers.origin, request.params.custom_identifier);
            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.delete('/api/v1/platform/payload/:id', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        if(!request.params.id) {
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        } else {
            try {
                return xummBackend.deletePayload(request.headers.origin, request.params.id);
            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/initiate/simplePayment', async (request, reply) => {
        console.log("simplePayment headers: " + JSON.stringify(request.headers));
        console.log("simplePayment request.params: " + JSON.stringify(request.params));
        //console.log("body: " + JSON.stringify(request.body));
        try {
            let genericPayloadOptions:GenericBackendPostRequestOptions = {};

            let xummPayload:XummTypes.XummPostPayloadBodyJson = {
                options: {
                    expire: 5
                },
                txjson: {
                    TransactionType: "Payment"
                }
            }
            
            try {
                let parseResult = deviceDetector.parse(request.headers['user-agent'])
                console.log("parsed user agent: " + JSON.stringify(parseResult));
                if(parseResult && parseResult.device && parseResult.device.type) {
                    genericPayloadOptions.web = 'desktop' === parseResult.device.type;
                }
            } catch(err) {
                console.log("failed to parse user agent");
                console.log(JSON.stringify(err));
            }

            let payloadResponse = await xummBackend.submitPayload(xummPayload, request.headers.origin, request.headers.referer, genericPayloadOptions);
            return payloadResponse;
        } catch(err) {
            if('bithomp' == err) {
                return { success : false, error: true, message: "We can not contact our XRP Ledger service provider and therefore won't be able to to verify your transaction. Please try again later!"};
            }
            else
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
        }
    });

    fastify.get('/api/v1/initiate/simplePayment/:deviceType', async (request, reply) => {
        console.log("simplePayment/ headers: " + JSON.stringify(request.headers));
        console.log("simplePayment/ request.params: " + JSON.stringify(request.params));
        //console.log("body: " + JSON.stringify(request.body));
        try {
            let genericPayloadOptions:GenericBackendPostRequestOptions = {};

            let xummPayload:XummTypes.XummPostPayloadBodyJson = {
                options: {
                    expire: 5
                },
                txjson: {
                    TransactionType: "Payment"
                }
            }

            if(request.params && request.params && (request.params.deviceType === 'app' || request.params.deviceType === 'web')) {
                genericPayloadOptions.web = 'web' === request.params.deviceType;
            } else {
                try {
                    let parseResult = deviceDetector.parse(request.headers['user-agent'])
                    console.log("parsed user agent: " + JSON.stringify(parseResult));
                    if(parseResult && parseResult.device && parseResult.device.type) {
                        genericPayloadOptions.web = 'desktop' === parseResult.device.type;
                    }
                } catch(err) {
                    console.log("failed to parse user agent");
                    console.log(JSON.stringify(err));
                }
            }

            let payloadResponse = await xummBackend.submitPayload(xummPayload, request.headers.origin, request.headers.referer, genericPayloadOptions);
            return payloadResponse;
        } catch(err) {
            if('bithomp' == err)
                return { success : false, error: true, message: "We can not contact our XRP Ledger service provider and therefore won't be able to to verify your transaction. Please try again later!"};
            else
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
        }
    });

    fastify.get('/api/v1/initiate/simplePaymentRedirect', async (request, reply) => {
        console.log("simplePayment headers: " + JSON.stringify(request.headers));
        console.log("simplePayment request.params: " + JSON.stringify(request.params));
        //console.log("body: " + JSON.stringify(request.body));
        try {
            let genericPayloadOptions:GenericBackendPostRequestOptions = {};

            let xummPayload:XummTypes.XummPostPayloadBodyJson = {
                options: {
                    expire: 5
                },
                txjson: { 
                    TransactionType: "Payment"
                }
            }
            
            try {
                let parseResult = deviceDetector.parse(request.headers['user-agent'])
                console.log("parsed user agent: " + JSON.stringify(parseResult));
                if(parseResult && parseResult.device && parseResult.device.type) {
                    genericPayloadOptions.web = 'desktop' === parseResult.device.type;
                }
            } catch(err) {
                console.log("failed to parse user agent");
                console.log(JSON.stringify(err));
            }

            let payload:XummTypes.XummPostPayloadResponse = await xummBackend.submitPayload(xummPayload, request.headers.origin, request.headers.referer, genericPayloadOptions);

            if(payload && payload.next && payload.next.always) {
                reply.redirect(307, payload.next.always);
            } else {
                reply.send({ success : false, error: true, message: 'Something went wrong. Please check your request'});
            }
            
        } catch(err) {
            if('bithomp' == err)
                return { success : false, error: true, message: "We can not contact our XRP Ledger service provider and therefore won't be able to to verify your transaction. Please try again later!"};
            else
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
        }
    });

    fastify.get('/api/v1/check/signinToValidatePayment/:signinPayloadId', async (request, reply) => {
        console.log("headers: " + JSON.stringify(request.headers));
        console.log("query: " + JSON.stringify(request.query));
        if(!request.params.signinPayloadId) {
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        } else {
            try {
                return special.checkSignInToValidatePayment(request.params.signinPayloadId, request.headers.origin, request.query.referer ? request.query.referer : request.headers.referer);
            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/check/payment/:payloadId', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        if(!request.params.payloadId) {
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        } else {
            try {
                let payloadInfo:XummTypes.XummGetPayloadResponse = await xummBackend.getPayloadInfoByOrigin(request.headers.origin, request.params.payloadId);

                if(payloadInfo && special.successfullPaymentPayloadValidation(payloadInfo))
                    return special.validatePaymentOnLedger(payloadInfo.response.txid, payloadInfo);

                //we didn't go into the success:true -> so return false :)
                return {success : false}
                
            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/check/payment/:frontendUserId/:payloadId', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        if(!request.params.frontendUserId)
            reply.code(500).send('Please provide a frontendUserId. Calls without frontendUserId are not allowed');
        else if(!request.params.payloadId)
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        else {
            try {
                let payloadInfo:XummTypes.XummGetPayloadResponse = await special.getPayloadInfoForFrontendId(request.headers.origin, request.params, 'payment');

                if(payloadInfo && special.successfullPaymentPayloadValidation(payloadInfo))
                    return special.validatePaymentOnLedger(payloadInfo.response.txid, payloadInfo);

                //we didn't go into the success:true -> so return false :)
                return {success : false}
                
            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/check/payment/referer/:payloadId', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        if(!request.params.payloadId)
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        else {
            try {
                let payloadInfo:XummTypes.XummGetPayloadResponse = await xummBackend.getPayloadInfoByOrigin(request.headers.origin, request.params.payloadId);

                if(payloadInfo && special.successfullPaymentPayloadValidation(payloadInfo))
                    return special.validatePaymentOnLedger(payloadInfo.response.txid, payloadInfo);

                //we didn't go into the success:true -> so return false :)
                return {success : false}
                
            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/check/payment/referer/:frontendUserId/:payloadId', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        if(!request.params.frontendUserId)
            reply.code(500).send('Please provide a frontendUserId. Calls without frontendUserId are not allowed');
        else if(!request.params.payloadId)
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        else {
            try {
                let payloadInfo:XummTypes.XummGetPayloadResponse = await special.getPayloadInfoForFrontendId(request.headers.origin, request.params, 'payment', request.query.referer ? request.query.referer : request.headers.referer);

                if(payloadInfo && special.successfullPaymentPayloadValidation(payloadInfo))
                    return special.validatePaymentOnLedger(payloadInfo.response.txid, payloadInfo);

                //we didn't go into the success:true -> so return false :)
                return {success : false}
                
            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/check/timed/payment/:payloadId', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        if(!request.params.payloadId)
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        else {
            try {
                let payloadInfo:XummTypes.XummGetPayloadResponse = await xummBackend.getPayloadInfoByOrigin(request.headers.origin, request.params.payloadId);

                if(payloadInfo)
                    return special.validateTimedPaymentPayload(request.headers.origin, request.headers.referer, payloadInfo);
                
                //we didn't go into the success:true -> so return false :)
                return {success : false }
            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/check/timed/payment/:frontendUserId/:payloadId', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        if(!request.params.frontendUserId)
            reply.code(500).send('Please provide a frontendUserId. Calls without frontendUserId are not allowed');
        else if(!request.params.payloadId)
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        else {
            try {
                let payloadInfo:XummTypes.XummGetPayloadResponse = await special.getPayloadInfoForFrontendId(request.headers.origin, request.params, 'payment');

                if(payloadInfo)
                    return special.validateTimedPaymentPayload(request.headers.origin, request.headers.referer, payloadInfo);
                
                //we didn't go into the success:true -> so return false :)
                return {success : false}

            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/check/timed/payment/referer/:payloadId', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        //console.log("request query: " + JSON.stringify(request.query));
        if(!request.params.payloadId)
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        else {
            try {
                let payloadInfo:XummTypes.XummGetPayloadResponse = await xummBackend.getPayloadInfoByOrigin(request.headers.origin, request.params.payloadId);

                if(payloadInfo)
                    return special.validateTimedPaymentPayload(request.headers.origin, request.query.referer ? request.query.referer : request.headers.referer, payloadInfo);
                
                //we didn't go into the success:true -> so return false :)
                return {success : false}

            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/check/timed/payment/referer/:frontendUserId/:payloadId', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        //console.log("request query: " + JSON.stringify(request.query));
        if(!request.params.frontendUserId)
            reply.code(500).send('Please provide a frontendUserId. Calls without frontendUserId are not allowed');
        else if(!request.params.payloadId)
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        else {
            try {
                let payloadInfo:XummTypes.XummGetPayloadResponse = await special.getPayloadInfoForFrontendId(request.headers.origin, request.params, 'payment', request.query.referer ? request.query.referer : request.headers.referer);

                if(payloadInfo)
                    return special.validateTimedPaymentPayload(request.headers.origin, request.query.referer ? request.query.referer : request.headers.referer, payloadInfo);
                
                //we didn't go into the success:true -> so return false :)
                return {success : false}

            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/check/signin/:payloadId', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        if(!request.params.payloadId)
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        else {
            try {
                let payloadInfo:XummTypes.XummGetPayloadResponse = await xummBackend.getPayloadInfoByOrigin(request.headers.origin,request.params.payloadId);

                if(payloadInfo && special.successfullSignInPayloadValidation(payloadInfo))
                    return {success: true, account: payloadInfo.response.account}
                
                //we didn't go into the success:true -> so return false :)
                return {success : false, account: payloadInfo.response.account }

            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/check/signin/:frontendUserId/:payloadId', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        if(!request.params.frontendUserId)
            reply.code(500).send('Please provide a frontendUserId. Calls without frontendUserId are not allowed');
        else if(!request.params.payloadId)
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        else {
            try {
                let payloadInfo:XummTypes.XummGetPayloadResponse = await special.getPayloadInfoForFrontendId(request.headers.origin, request.params, 'signin');

                if(payloadInfo && special.successfullSignInPayloadValidation(payloadInfo))
                    return {success: true, account: payloadInfo.response.account }
                
                //we didn't go into the success:true -> so return false :)
                return {success : false, account: payloadInfo.response.account }

            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/check/signin/referer/:frontendUserId/:payloadId', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        if(!request.params.frontendUserId)
            reply.code(500).send('Please provide a frontendUserId. Calls without frontendUserId are not allowed');
        else if(!request.params.payloadId)
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        else {
            try {
                let payloadInfo:XummTypes.XummGetPayloadResponse = await special.getPayloadInfoForFrontendId(request.headers.origin, request.params, 'signin', request.query.referer ? request.query.referer : request.headers.referer);

                if(payloadInfo && special.successfullSignInPayloadValidation(payloadInfo))
                    return {success: true, account: payloadInfo.response.account }
                
                //we didn't go into the success:true -> so return false :)
                return {success : false, account: payloadInfo.response.account }

            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/xrpl/validatetx/:payloadId', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        if(!request.params.payloadId) {
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        } else {
            try {
                let payloadInfo:XummTypes.XummGetPayloadResponse = await xummBackend.getPayloadInfoByOrigin(request.headers.origin, request.params.payloadId)

                if(payloadInfo && payloadInfo.response && payloadInfo.response.txid) {
                    let txResult:any = await special.validateXRPLTransaction(payloadInfo.response.txid);
                    if(txResult)
                        txResult.account = payloadInfo.response.account;

                    return txResult;
                }
                
                //we didn't go into the success:true -> so return false :)
                return {success : false, testnet: false, account: payloadInfo.response.account }

            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/escrow/validatepayment/:payloadId', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        if(!request.params.payloadId) {
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        } else {
            try {
                let payloadInfo:XummTypes.XummGetPayloadResponse = await xummBackend.getPayloadInfoByOrigin(request.headers.origin, request.params.payloadId)

                console.log("escrow/validatepayment PAYLOAD: " + JSON.stringify(payloadInfo));

                if(payloadInfo && special.successfullPaymentPayloadValidation(payloadInfo)) {
                    let txResult:TransactionValidation = await special.validatePaymentOnLedger(payloadInfo.response.txid, payloadInfo);

                    console.log("escrow/validatepayment TXRESULT: " + JSON.stringify(txResult));

                    if(txResult) {
                        if(payloadInfo.custom_meta.blob) {
                            txResult.account = payloadInfo.response.account;
                            let escrow:any = payloadInfo.custom_meta.blob;

                            console.log("escrow/validatepayment ESCROW: " + JSON.stringify(escrow));

                            if(escrow && txResult.success && txResult.account == escrow.account && ((txResult.testnet == escrow.testnet) || (escrow.testnet && !txResult.testnet))) {
                                //insert escrow
                                let addEscrow:any = await special.addEscrow(escrow);

                                console.log("Add escrow: " + JSON.stringify(addEscrow));

                                if(addEscrow && addEscrow.success)
                                    return txResult;
                                else
                                    return {success : false, testnet: txResult.testnet, account: payloadInfo.response.account, error: true, message: "Escrow could not be stored. Please contact the website owner!" }
                            } else {
                                return {success : false, testnet: txResult.testnet, account: payloadInfo.response.account, error: true, message: "The escrow account does not equal the payment account or you submitted the transaction on a different network (Main/Test)." }
                            }
                        } else {
                            return {success : false, testnet: txResult.testnet, account: payloadInfo.response.account, error: true, message: "The transaction could not be matched to an escrow. Please contact the website owner if you think that is wrong!" }
                        }

                    } else {
                        return {success : false, testnet: false, account: payloadInfo.response.account, error: true, message: "Your transaction could not be verfied!" }
                    }
                }
                
                //we didn't go into the success:true -> so return false :)
                return {success : false, testnet: false, account: payloadInfo.response.account }

            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/v1/escrow/signinToDeleteEscrow/:payloadId', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        if(!request.params.payloadId)
            reply.code(500).send('Please provide a payload id. Calls without payload id are not allowed');
        else {
            try {
                let payloadInfo:XummTypes.XummGetPayloadResponse = await xummBackend.getPayloadInfoByOrigin(request.headers.origin,request.params.payloadId);

                console.log("escrow/signinToDeleteEscrow PAYLOAD: " + JSON.stringify(payloadInfo));

                if(payloadInfo && special.successfullSignInPayloadValidation(payloadInfo) && payloadInfo.custom_meta && payloadInfo.custom_meta.blob && payloadInfo.response.account === payloadInfo.custom_meta.blob.account ) {
                    let deleteSuccess = await special.deleteEscrow(payloadInfo.custom_meta.blob);
                    console.log("escrow/signinToDeleteEscrow deleteSuccess: " + JSON.stringify(deleteSuccess));
                    deleteSuccess.account = payloadInfo.response.account;
                    return deleteSuccess;
                } else {
                    //we didn't go into the success:true -> so return false :)
                    return {success : false, account: payloadInfo.response.account }
                }
            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.post('/api/v1/escrows', async (request, reply) => {
        console.log("body params escrow: " + JSON.stringify(request.body));
        if(!request.body || !request.body.account) {
            reply.code(500).send('Please provide an XRPL account as body param. Calls without account are not allowed');
        } else {
            try {
                let loadEscrowResponse:any = await special.loadEscrowsForAccount(request.body);
                return loadEscrowResponse;                
            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        }
    });

    fastify.get('/api/resetCache/:token', async (request, reply) => {
        //console.log("request params: " + JSON.stringify(request.params));
        try {
            if(config.RESET_CACHE_TOKEN === request.params.token) {
                await db.resetCache();
                await xummBackend.resetDBCache();
                await special.resetDBCache();

                return {success: true }
            } else
                return {success: false }
        } catch {
            return { success : false, error: true, message: 'Something went wrong. Please check your request'};
        }
    });

    fastify.post('/api/v1/webhook', async (request, reply) => {
        console.log("webhook headers: " + JSON.stringify(request.headers));
        //console.log("webhook body: " + JSON.stringify(request.body));
       
        try {
            let webhookRequest:XummTypes.XummWebhookBody = request.body;
            let payloadInfo:XummTypes.XummGetPayloadResponse = await xummBackend.getPayloadInfoByAppId(webhookRequest.meta.application_uuidv4, webhookRequest.meta.payload_uuidv4);
            
            //check if we have to store the user
            try {
                let tmpInfo:any = await db.getTempInfo({payloadId: payloadInfo.meta.uuid, applicationId: payloadInfo.application.uuidv4});

                if(tmpInfo) {
                    if(payloadInfo && payloadInfo.application && payloadInfo.application.issued_user_token) {
                        await db.saveUser(tmpInfo.origin, payloadInfo.application.uuidv4, tmpInfo.frontendId, payloadInfo.application.issued_user_token);
                        await db.storePayloadForXummId(tmpInfo.origin, tmpInfo.referer, payloadInfo.application.uuidv4, payloadInfo.application.issued_user_token, payloadInfo.meta.uuid, payloadInfo.payload.tx_type);
                    }

                    //store payload to XRPL account
                    if(payloadInfo && payloadInfo.response && payloadInfo.response.account) {
                        await db.storePayloadForXRPLAccount(tmpInfo.origin, tmpInfo.referer, payloadInfo.application.uuidv4, payloadInfo.response.account, webhookRequest.userToken.user_token, payloadInfo.meta.uuid, payloadInfo.payload.tx_type);
                    }

                    await db.deleteTempInfo(tmpInfo);

                    return {success: true}
                } else {
                    return {success: false}
                }
            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        } catch {
            return { success : false, error: true, message: 'Something went wrong. Please check your request'};
        }
    });

    fastify.post('/api/v1/webhook/*', async (request, reply) => {
        console.log("webhook/* headers: " + JSON.stringify(request.headers));
        //console.log("webhook body: " + JSON.stringify(request.body));
       
        try {
            let webhookRequest:XummTypes.XummWebhookBody = request.body;
            let payloadInfo:XummTypes.XummGetPayloadResponse = await xummBackend.getPayloadInfoByAppId(webhookRequest.meta.application_uuidv4, webhookRequest.meta.payload_uuidv4);
            
            //check if we have to store the user
            try {
                let tmpInfo:any = await db.getTempInfo({payloadId: payloadInfo.meta.uuid, applicationId: payloadInfo.application.uuidv4});

                if(tmpInfo) {
                    if(payloadInfo && payloadInfo.application && payloadInfo.application.issued_user_token) {
                        await db.saveUser(tmpInfo.origin, payloadInfo.application.uuidv4, tmpInfo.frontendId, payloadInfo.application.issued_user_token);
                        await db.storePayloadForXummId(tmpInfo.origin, tmpInfo.referer, payloadInfo.application.uuidv4, payloadInfo.application.issued_user_token, payloadInfo.meta.uuid, payloadInfo.payload.tx_type);
                    }

                    //store payload to XRPL account
                    if(payloadInfo && payloadInfo.response && payloadInfo.response.account) {
                        await db.storePayloadForXRPLAccount(tmpInfo.origin, tmpInfo.referer, payloadInfo.application.uuidv4, payloadInfo.response.account, webhookRequest.userToken.user_token, payloadInfo.meta.uuid, payloadInfo.payload.tx_type);
                    }

                    await db.deleteTempInfo(tmpInfo);

                    return {success: true}
                } else {
                    return {success: false}
                }
            } catch {
                return { success : false, error: true, message: 'Something went wrong. Please check your request'};
            }
        } catch {
            return { success : false, error: true, message: 'Something went wrong. Please check your request'};
        }
    });

    next()
}

