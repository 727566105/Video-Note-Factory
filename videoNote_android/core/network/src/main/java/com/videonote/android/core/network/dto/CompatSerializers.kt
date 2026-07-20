package com.videonote.android.core.network.dto

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonEncoder

/**
 * 容错类型转换 Serializer 集合
 *
 * 后端某些字段类型不稳定（可能返回 int/float/string/null 任意类型），
 * 这些 serializer 统一把 JSON 中的各种原始类型转成 Kotlin 的目标类型，
 * 任何无法转换的值退回默认值，绝不抛 JsonDecodingException。
 *
 * 设计目标：宁可拿到空值/默认值，也不能让笔记/Feed/订阅列表整个反序列化失败。
 */

// ---------- String? 兼容（接受 number / boolean / string / null） ----------

/**
 * 把 JSON 任意原始值（number/boolean/string/null）序列化为 String?。
 * - number 45167.0 -> "45167.0"
 * - number 0       -> "0"
 * - boolean true  -> "true"
 * - string "abc"  -> "abc"
 * - null          -> null
 * - object/array  -> JSON 字符串
 *
 * 用法：`@Serializable(with = AnyToStringSerializer::class) val duration: String? = null`
 */
object AnyToStringSerializer : KSerializer<String?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("AnyToString", PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): String? {
        return if (decoder is JsonDecoder) {
            when (val element = decoder.decodeJsonElement()) {
                is JsonNull -> null
                is JsonPrimitive -> element.content
                else -> element.toString()
            }
        } else {
            decoder.decodeString()
        }
    }

    override fun serialize(encoder: Encoder, value: String?) {
        if (encoder is JsonEncoder) {
            if (value == null) encoder.encodeNull() else encoder.encodeJsonElement(JsonPrimitive(value))
        } else {
            if (value == null) encoder.encodeNull() else encoder.encodeString(value)
        }
    }
}

// ---------- Int? 兼容（接受 int / float / string / boolean / null） ----------

/**
 * 把 JSON 任意原始值转成 Int?。
 * - number 369 -> 369
 * - number 369.0 -> 369（截断小数）
 * - string "369" -> 369
 * - string "abc" -> null（无法解析）
 * - null -> null
 *
 * 用法：`@Serializable(with = AnyToIntSerializer::class) val id: Int? = null`
 */
object AnyToIntSerializer : KSerializer<Int?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("AnyToInt", PrimitiveKind.INT)

    override fun deserialize(decoder: Decoder): Int? {
        return if (decoder is JsonDecoder) {
            when (val element = decoder.decodeJsonElement()) {
                is JsonNull -> null
                is JsonPrimitive -> element.content.toIntOrNull()
                    ?: element.content.toDoubleOrNull()?.toInt()
                else -> null
            }
        } else {
            decoder.decodeInt().takeIf { it != 0 } ?: run {
                try { decoder.decodeInt() } catch (_: Exception) { null }
            }
        }
    }

    override fun serialize(encoder: Encoder, value: Int?) {
        if (value == null) encoder.encodeNull() else encoder.encodeInt(value)
    }
}

// ---------- Boolean? 兼容（接受 boolean / int 0,1 / string "true","false" / null） ----------

/**
 * 把 JSON 任意原始值转成 Boolean?。
 * - boolean true -> true
 * - int 1 -> true, int 0 -> false
 * - string "true" / "1" -> true, "false" / "0" -> false
 * - null -> null
 *
 * 用法：`@Serializable(with = AnyToBooleanSerializer::class) val enabled: Boolean? = null`
 */
object AnyToBooleanSerializer : KSerializer<Boolean?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("AnyToBoolean", PrimitiveKind.BOOLEAN)

    override fun deserialize(decoder: Decoder): Boolean? {
        return if (decoder is JsonDecoder) {
            when (val element = decoder.decodeJsonElement()) {
                is JsonNull -> null
                is JsonPrimitive -> when {
                    element.isString -> when (element.content.lowercase()) {
                        "true", "1" -> true
                        "false", "0" -> false
                        else -> null
                    }
                    else -> element.content.toBooleanStrictOrNull()
                }
                else -> null
            }
        } else {
            decoder.decodeBoolean().takeIf { it } ?: false
        }
    }

    override fun serialize(encoder: Encoder, value: Boolean?) {
        if (value == null) encoder.encodeNull() else encoder.encodeBoolean(value)
    }
}

// ---------- Boolean 兼容（非空版本，默认 false） ----------

/**
 * 非空 Boolean 版本：无法转换时返回 false（不抛异常）。
 * 用于 `val is_read: Boolean = false` 这种有默认值的字段。
 */
object AnyToBooleanStrictSerializer : KSerializer<Boolean> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("AnyToBooleanStrict", PrimitiveKind.BOOLEAN)

    override fun deserialize(decoder: Decoder): Boolean {
        return if (decoder is JsonDecoder) {
            when (val element = decoder.decodeJsonElement()) {
                is JsonNull -> false
                is JsonPrimitive -> when {
                    element.isString -> element.content.lowercase() in listOf("true", "1")
                    else -> element.content.toBooleanStrictOrNull() ?: (element.content.toIntOrNull() == 1)
                }
                else -> false
            }
        } else {
            try { decoder.decodeBoolean() } catch (_: Exception) { false }
        }
    }

    override fun serialize(encoder: Encoder, value: Boolean) {
        encoder.encodeBoolean(value)
    }
}

// ---------- Int 兼容（非空版本，默认 0） ----------

/**
 * 非空 Int 版本：无法转换时返回 0（不抛异常）。
 */
object AnyToIntStrictSerializer : KSerializer<Int> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("AnyToIntStrict", PrimitiveKind.INT)

    override fun deserialize(decoder: Decoder): Int {
        return if (decoder is JsonDecoder) {
            when (val element = decoder.decodeJsonElement()) {
                is JsonNull -> 0
                is JsonPrimitive -> element.content.toIntOrNull()
                    ?: element.content.toDoubleOrNull()?.toInt()
                    ?: 0
                else -> 0
            }
        } else {
            try { decoder.decodeInt() } catch (_: Exception) { 0 }
        }
    }

    override fun serialize(encoder: Encoder, value: Int) {
        encoder.encodeInt(value)
    }
}
