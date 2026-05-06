package com.edot.reactnative

import co.elastic.otel.android.interceptor.Interceptor
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import io.opentelemetry.api.common.AttributeKey
import io.opentelemetry.api.common.Attributes
import io.opentelemetry.api.logs.Severity
import io.opentelemetry.sdk.common.CompletableResultCode
import io.opentelemetry.sdk.logs.data.LogRecordData
import io.opentelemetry.sdk.logs.export.LogRecordExporter
import io.opentelemetry.sdk.trace.data.SpanData
import io.opentelemetry.sdk.trace.export.SpanExporter
import java.util.regex.Pattern

/// Compiles JS-side configuration ([attributeRedactions], [ignoreSpanNames],
/// [ignoreLogPatterns], etc.) into the typed callbacks / interceptors that
/// `ElasticApmAgent.builder` consumes. Mirrors the iOS helpers
/// `compileAttributeRedactor`, `compileSpanNamePredicates`, and
/// `compileLogPredicates` in `EdotReactNative.swift` so behaviour matches
/// across platforms.
internal object EdotConfigCompilers {

    fun compileAttributeRedactor(rules: ReadableMap?): Interceptor<Attributes>? {
        if (rules == null) return null

        val dropExact = rules.getStringArrayOrEmpty("drop")
        val dropPattern = rules.compilePatternOrNull("dropPattern")
        val masks = rules.getStringMapOrEmpty("mask")
        val maskPatterns = rules.compileMaskPatterns("maskPattern")

        if (
            dropExact.isEmpty() &&
            dropPattern == null &&
            masks.isEmpty() &&
            maskPatterns.isEmpty()
        ) {
            return null
        }

        return Interceptor<Attributes> { existing ->
            val builder = Attributes.builder()
            for ((key, value) in existing.asMap()) {
                val keyName = key.key
                if (keyName in dropExact) continue
                if (dropPattern != null && dropPattern.matcher(keyName).find()) continue

                val replacement = masks[keyName]
                    ?: maskPatterns.firstOrNull { (regex, _) ->
                        regex.matcher(keyName).find()
                    }?.second

                if (replacement != null) {
                    @Suppress("UNCHECKED_CAST")
                    builder.put(AttributeKey.stringKey(keyName), replacement)
                } else {
                    @Suppress("UNCHECKED_CAST")
                    builder.put(key as AttributeKey<Any>, value)
                }
            }
            builder.build()
        }
    }

    fun compileSpanNamePredicates(rules: ReadableMap?, key: String): List<(String) -> Boolean> {
        val array = rules?.takeIf { it.hasKey(key) }?.getArray(key) ?: return emptyList()
        val out = mutableListOf<(String) -> Boolean>()
        for (i in 0 until array.size()) {
            when (array.getType(i)) {
                ReadableType.String -> {
                    val exact = array.getString(i) ?: continue
                    out.add { name -> name == exact }
                }
                ReadableType.Map -> {
                    val patternMap = array.getMap(i) ?: continue
                    val regex = patternMap.compilePatternOrNull("source") ?: run {
                        compileFromPatternObject(patternMap)
                    } ?: continue
                    out.add { name -> regex.matcher(name).find() }
                }
                else -> Unit
            }
        }
        return out
    }

    data class LogFilterRule(
        private val namePredicate: ((String?) -> Boolean)?,
        private val minSeverity: Severity?,
    ) {
        fun matches(record: LogRecordData): Boolean {
            if (namePredicate != null && namePredicate.invoke(record.eventName)) {
                return true
            }
            if (minSeverity != null) {
                val recordSeverity = record.severity ?: return false
                return recordSeverity.severityNumber < minSeverity.severityNumber
            }
            return false
        }
    }

    fun compileLogFilterRules(rules: ReadableMap?, key: String): List<LogFilterRule> {
        val array = rules?.takeIf { it.hasKey(key) }?.getArray(key) ?: return emptyList()
        val out = mutableListOf<LogFilterRule>()
        for (i in 0 until array.size()) {
            if (array.getType(i) != ReadableType.Map) continue
            val rule = array.getMap(i) ?: continue

            val namePredicate: ((String?) -> Boolean)? = when {
                rule.hasKey("name") && rule.getType("name") == ReadableType.String -> {
                    val exact = rule.getString("name")
                    if (exact != null) ({ name -> name == exact }) else null
                }
                rule.hasKey("name") && rule.getType("name") == ReadableType.Map -> {
                    val regex = rule.getMap("name")?.let { compileFromPatternObject(it) }
                    if (regex != null) ({ name -> name != null && regex.matcher(name).find() })
                    else null
                }
                else -> null
            }

            val minSeverity = rule.takeIf { it.hasKey("minSeverity") }
                ?.getString("minSeverity")
                ?.let { parseSeverity(it) }

            if (namePredicate != null || minSeverity != null) {
                out.add(LogFilterRule(namePredicate, minSeverity))
            }
        }
        return out
    }

    fun makeSpanFilteringExporterInterceptor(
        predicates: List<(String) -> Boolean>,
    ): Interceptor<SpanExporter>? {
        if (predicates.isEmpty()) return null
        return Interceptor<SpanExporter> { delegate ->
            object : SpanExporter {
                override fun export(spans: Collection<SpanData>): CompletableResultCode {
                    val kept = spans.filterNot { span ->
                        predicates.any { it(span.name) }
                    }
                    if (kept.isEmpty()) return CompletableResultCode.ofSuccess()
                    return delegate.export(kept)
                }

                override fun flush(): CompletableResultCode = delegate.flush()

                override fun shutdown(): CompletableResultCode = delegate.shutdown()
            }
        }
    }

    fun makeLogFilteringExporterInterceptor(
        rules: List<LogFilterRule>,
    ): Interceptor<LogRecordExporter>? {
        if (rules.isEmpty()) return null
        return Interceptor<LogRecordExporter> { delegate ->
            object : LogRecordExporter {
                override fun export(records: Collection<LogRecordData>): CompletableResultCode {
                    val kept = records.filterNot { record ->
                        rules.any { it.matches(record) }
                    }
                    if (kept.isEmpty()) return CompletableResultCode.ofSuccess()
                    return delegate.export(kept)
                }

                override fun flush(): CompletableResultCode = delegate.flush()

                override fun shutdown(): CompletableResultCode = delegate.shutdown()
            }
        }
    }

    private fun parseSeverity(raw: String): Severity? = when (raw) {
        "trace" -> Severity.TRACE
        "debug" -> Severity.DEBUG
        "info" -> Severity.INFO
        "warn" -> Severity.WARN
        "error" -> Severity.ERROR
        "fatal" -> Severity.FATAL
        else -> null
    }

    private fun ReadableMap.getStringArrayOrEmpty(key: String): List<String> {
        if (!hasKey(key)) return emptyList()
        if (getType(key) != ReadableType.Array) return emptyList()
        val array = getArray(key) ?: return emptyList()
        val out = mutableListOf<String>()
        for (i in 0 until array.size()) {
            if (array.getType(i) == ReadableType.String) {
                array.getString(i)?.let { out.add(it) }
            }
        }
        return out
    }

    private fun ReadableMap.getStringMapOrEmpty(key: String): Map<String, String> {
        if (!hasKey(key)) return emptyMap()
        if (getType(key) != ReadableType.Map) return emptyMap()
        val sub = getMap(key) ?: return emptyMap()
        val out = mutableMapOf<String, String>()
        val iterator = sub.keySetIterator()
        while (iterator.hasNextKey()) {
            val k = iterator.nextKey()
            if (sub.getType(k) == ReadableType.String) {
                sub.getString(k)?.let { out[k] = it }
            }
        }
        return out
    }

    private fun ReadableMap.compilePatternOrNull(key: String): Pattern? {
        if (!hasKey(key)) return null
        if (getType(key) != ReadableType.Map) return null
        val sub = getMap(key) ?: return null
        return compileFromPatternObject(sub)
    }

    private fun ReadableMap.compileMaskPatterns(key: String): List<Pair<Pattern, String>> {
        if (!hasKey(key)) return emptyList()
        if (getType(key) != ReadableType.Array) return emptyList()
        val array = getArray(key) ?: return emptyList()
        val out = mutableListOf<Pair<Pattern, String>>()
        for (i in 0 until array.size()) {
            if (array.getType(i) != ReadableType.Map) continue
            val entry = array.getMap(i) ?: continue
            val regex = compileFromPatternObject(entry) ?: continue
            val replacement = entry.takeIf { it.hasKey("replacement") }?.getString("replacement")
                ?: continue
            out.add(regex to replacement)
        }
        return out
    }

    private fun compileFromPatternObject(obj: ReadableMap): Pattern? {
        if (!obj.hasKey("source") || obj.getType("source") != ReadableType.String) return null
        val source = obj.getString("source") ?: return null
        var flags = 0
        if (obj.hasKey("flags") && obj.getType("flags") == ReadableType.String) {
            val raw = obj.getString("flags") ?: ""
            if (raw.contains("i")) flags = flags or Pattern.CASE_INSENSITIVE
            if (raw.contains("m")) flags = flags or Pattern.MULTILINE
            if (raw.contains("s")) flags = flags or Pattern.DOTALL
        }
        return runCatching { Pattern.compile(source, flags) }.getOrNull()
    }
}
