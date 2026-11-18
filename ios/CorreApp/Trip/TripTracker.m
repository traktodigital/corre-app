#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(TripTracker, NSObject)

RCT_EXTERN_METHOD(requestPermission:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getPermissionStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(start:(NSString *)tripId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stop:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getLastLocation:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
