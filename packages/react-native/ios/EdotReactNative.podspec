require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'EdotReactNative'
  s.version      = package['version']
  s.summary      = package['description']
  s.homepage     = 'https://github.com/anthropic-edot/react-native'
  s.license      = package['license']
  s.author       = 'Anthropic'
  s.source       = { :git => 'https://github.com/anthropic-edot/react-native.git', :tag => s.version }

  s.platform     = :ios, '16.0'
  s.swift_version = '5.9'

  s.source_files = '*.{h,m,swift}'

  s.dependency 'React-Core'
  # ElasticApm (EDOT iOS SDK) is distributed via SPM.
  # The consumer app must add the SPM package: https://github.com/elastic/apm-agent-ios
  # For pod-based projects, ElasticApm can be added as a vendored framework.
end
