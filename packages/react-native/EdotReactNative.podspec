require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

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

  s.source_files = 'ios/**/*.{swift,h,m}'
  s.exclude_files = 'ios/EdotReactNative-Bridging-Header.h'

  base_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  if defined?(spm_dependency)
    spm_dependency(s,
      url: 'https://github.com/elastic/apm-agent-ios.git',
      requirement: { kind: 'upToNextMajorVersion', minimumVersion: '2.0.0' },
      products: ['ElasticApm']
    )
    spm_dependency(s,
      url: 'https://github.com/open-telemetry/opentelemetry-swift.git',
      requirement: { kind: 'upToNextMajorVersion', minimumVersion: '2.2.1' },
      products: [
        'URLSessionInstrumentation',
        'OpenTelemetryProtocolExporter',
        'OpenTelemetryProtocolExporterHTTP',
        'PersistenceExporter'
      ]
    )
    s.pod_target_xcconfig = base_xcconfig.merge(
      'OTHER_SWIFT_FLAGS' => '$(inherited) -DELASTIC_APM_AVAILABLE',
      'SWIFT_ACTIVE_COMPILATION_CONDITIONS' => '$(inherited) ELASTIC_APM_AVAILABLE'
    )
  else
    s.pod_target_xcconfig = base_xcconfig
  end

  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency 'React-Core'
  end
end
