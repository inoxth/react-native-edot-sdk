import Foundation

#if ELASTIC_APM_AVAILABLE
import OpenTelemetryApi

/// Re-implements apm-agent-ios v2.0.0's `CPUSampler` and `MemorySampler`
/// against our resource-aware `MeterProvider`.
///
/// Same metric names, attributes, and units as upstream so existing
/// dashboards keep working:
/// - `system.cpu.usage` (double gauge, attribute `state=app`)
/// - `system.memory.usage` (long gauge, attribute `state=app`)
final class EdotSystemMetrics {
  private static let cpuInstrumentationName = "CPU Sampler"
  private static let memoryInstrumentationName = "Memory Sampler"
  private static let instrumentationVersion = "1.0.0"

  private let cpuMeter: any Meter
  private let memoryMeter: any Meter
  private let cpuGauge: ObservableDoubleGauge
  private let memoryGauge: ObservableLongGauge

  init(meterProvider: any MeterProvider) {
    self.cpuMeter = meterProvider
      .meterBuilder(name: Self.cpuInstrumentationName)
      .setInstrumentationVersion(instrumentationVersion: Self.instrumentationVersion)
      .build()
    self.memoryMeter = meterProvider
      .meterBuilder(name: Self.memoryInstrumentationName)
      .setInstrumentationVersion(instrumentationVersion: Self.instrumentationVersion)
      .build()

    self.cpuGauge = cpuMeter
      .gaugeBuilder(name: "system.cpu.usage")
      .buildWithCallback { measurement in
        measurement.record(
          value: EdotSystemMetrics.cpuFootprint(),
          attributes: ["state": .string("app")]
        )
      }

    self.memoryGauge = memoryMeter
      .gaugeBuilder(name: "system.memory.usage")
      .ofLongs()
      .buildWithCallback { measurement in
        guard let usage = EdotSystemMetrics.memoryFootprint() else { return }
        measurement.record(
          value: Int(usage),
          attributes: ["state": .string("app")]
        )
      }
  }

  deinit {
    cpuGauge.close()
    memoryGauge.close()
  }

  private static func cpuFootprint() -> Double {
    var taskInfoCount = mach_msg_type_number_t(TASK_INFO_MAX)
    var taskInfo = [integer_t](repeating: 0, count: Int(taskInfoCount))
    var kr = task_info(
      mach_task_self_,
      task_flavor_t(TASK_BASIC_INFO),
      &taskInfo,
      &taskInfoCount
    )
    if kr != KERN_SUCCESS { return -1 }

    var threadList: thread_act_array_t?
    var threadCount: mach_msg_type_number_t = 0
    defer {
      if let threadList {
        vm_deallocate(
          mach_task_self_,
          vm_address_t(UnsafePointer(threadList).pointee),
          vm_size_t(threadCount)
        )
      }
    }
    kr = task_threads(mach_task_self_, &threadList, &threadCount)
    if kr != KERN_SUCCESS { return -1 }

    var totalCpu: Double = 0
    if let threadList {
      for index in 0 ..< Int(threadCount) {
        var threadInfoCount = mach_msg_type_number_t(THREAD_INFO_MAX)
        var threadInfoBuffer = [integer_t](repeating: 0, count: Int(threadInfoCount))
        let threadKr = thread_info(
          threadList[index],
          thread_flavor_t(THREAD_BASIC_INFO),
          &threadInfoBuffer,
          &threadInfoCount
        )
        if threadKr != KERN_SUCCESS { continue }
        let basic = threadBasicInfo(from: threadInfoBuffer)
        if basic.flags != TH_FLAGS_IDLE {
          totalCpu += (Double(basic.cpu_usage) / Double(TH_USAGE_SCALE)) * 100.0
        }
      }
    }
    return totalCpu
  }

  private static func threadBasicInfo(from buffer: [integer_t]) -> thread_basic_info {
    var info = thread_basic_info()
    info.user_time = time_value_t(seconds: buffer[0], microseconds: buffer[1])
    info.system_time = time_value_t(seconds: buffer[2], microseconds: buffer[3])
    info.cpu_usage = buffer[4]
    info.policy = buffer[5]
    info.run_state = buffer[6]
    info.flags = buffer[7]
    info.suspend_count = buffer[8]
    info.sleep_time = buffer[9]
    return info
  }

  private static func memoryFootprint() -> mach_vm_size_t? {
    let infoCount = mach_msg_type_number_t(
      MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size
    )
    let rev1Count = mach_msg_type_number_t(
      MemoryLayout.offset(of: \task_vm_info_data_t.min_address)! / MemoryLayout<integer_t>.size
    )
    var info = task_vm_info_data_t()
    var count = infoCount
    let kr = withUnsafeMutablePointer(to: &info) { infoPtr in
      infoPtr.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { intPtr in
        task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), intPtr, &count)
      }
    }
    guard kr == KERN_SUCCESS, count >= rev1Count else { return nil }
    return info.phys_footprint
  }
}
#endif
