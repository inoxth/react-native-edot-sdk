import Foundation

#if ELASTIC_APM_AVAILABLE
import OpenTelemetryApi

/// Emits the cross-platform system metrics that apm-agent-ios does not provide
/// on the 1.2.1 stack:
/// - `system.cpu.usage` (double gauge, attribute `state=app`)
/// - `system.memory.usage` (long gauge, attribute `state=app`)
///
/// apm-agent-ios 1.2.1 registers only the LEGACY (resource-aware) meter
/// provider — not a stable one — so these are registered as legacy observable
/// gauges through `OpenTelemetry.instance.meterProvider`, the same provider
/// `recordMetric` uses. Names / attributes / scopes mirror Android's
/// `EdotSystemMetrics.kt` so cross-platform dashboards group both platforms.
enum EdotSystemMetrics {
  private static let cpuInstrumentationName = "CPU Sampler"
  private static let memoryInstrumentationName = "Memory Sampler"
  private static let instrumentationVersion = "1.0.0"

  private static let lock = NSLock()
  private static var cpuGauge: DoubleObserverMetric?
  private static var memoryGauge: IntObserverMetric?

  static func install() {
    lock.lock()
    defer { lock.unlock() }
    guard cpuGauge == nil, memoryGauge == nil else { return }

    let cpuMeter = OpenTelemetry.instance.meterProvider.get(
      instrumentationName: cpuInstrumentationName,
      instrumentationVersion: instrumentationVersion
    )
    cpuGauge = cpuMeter.createDoubleObservableGauge(name: "system.cpu.usage") { observer in
      observer.observe(value: cpuFootprint(), labels: ["state": "app"])
    }

    let memoryMeter = OpenTelemetry.instance.meterProvider.get(
      instrumentationName: memoryInstrumentationName,
      instrumentationVersion: instrumentationVersion
    )
    memoryGauge = memoryMeter.createIntObservableGauge(name: "system.memory.usage") { observer in
      guard let usage = memoryFootprint() else { return }
      observer.observe(value: Int(usage), labels: ["state": "app"])
    }
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
    guard let minAddressOffset = MemoryLayout.offset(of: \task_vm_info_data_t.min_address) else {
      return nil
    }
    let rev1Count = mach_msg_type_number_t(minAddressOffset / MemoryLayout<integer_t>.size)
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
