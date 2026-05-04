#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(EdotReactNative, NSObject)

RCT_EXTERN_METHOD(initialize:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getCurrentSessionId:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setUser:(NSDictionary *)userInfo)
RCT_EXTERN_METHOD(clearUser)
RCT_EXTERN_METHOD(setSessionAttribute:(NSString *)key value:(NSString *)value)
RCT_EXTERN_METHOD(setGlobalAttribute:(NSString *)key value:(NSString *)value)
RCT_EXTERN_METHOD(removeGlobalAttribute:(NSString *)key)
RCT_EXTERN_METHOD(reportJsException:(NSDictionary *)errorInfo)

RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD(startSpan:(NSString *)name
                                        attributes:(NSDictionary *)attributes
                                        parentSpanId:(NSString * _Nullable)parentSpanId
                                        instrumentationName:(NSString * _Nullable)instrumentationName)

RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD(startClientSpan:(NSString *)name
                                        attributes:(NSDictionary *)attributes
                                        parentSpanId:(NSString * _Nullable)parentSpanId
                                        instrumentationName:(NSString * _Nullable)instrumentationName)

RCT_EXTERN_METHOD(endSpan:(NSString *)spanId statusCode:(NSInteger)statusCode)
RCT_EXTERN_METHOD(setSpanAttribute:(NSString *)spanId key:(NSString *)key value:(NSString *)value)
RCT_EXTERN_METHOD(setSpanAttributeNumber:(NSString *)spanId key:(NSString *)key value:(nonnull NSNumber *)value)
RCT_EXTERN_METHOD(setSpanAttributeBoolean:(NSString *)spanId key:(NSString *)key value:(BOOL)value)
RCT_EXTERN_METHOD(recordSpanException:(NSString *)spanId errorInfo:(NSDictionary *)errorInfo)
RCT_EXTERN_METHOD(recordMetric:(NSString *)name
                  value:(double)value
                  attributes:(NSDictionary *)attributes
                  metricType:(NSString *)metricType)
RCT_EXTERN_METHOD(emitLog:(NSString *)severity
                  message:(NSString *)message
                  attributes:(NSDictionary *)attributes)
RCT_EXTERN_METHOD(setTrackingConsent:(NSString *)consent)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

@end
