#import <React/RCTBridgeModule.h>

// Ponte do módulo Swift JornadaGps (mesma API do Android: JornadaGpsModule.kt).
@interface RCT_EXTERN_MODULE(JornadaGps, NSObject)

RCT_EXTERN_METHOD(pedirPermissao:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(iniciar:(NSString *)jornadaId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(estado:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(encerrar:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
