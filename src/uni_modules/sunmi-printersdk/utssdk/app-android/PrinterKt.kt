package uni.app.UNI57F145C

import android.annotation.SuppressLint
import android.app.Application
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import com.sunmi.printerx.*
import com.sunmi.printerx.api.PrintResult
import com.sunmi.printerx.enums.Align
import com.sunmi.printerx.enums.DividingLine
import com.sunmi.printerx.enums.ErrorLevel
import com.sunmi.printerx.enums.HumanReadable
import com.sunmi.printerx.enums.ImageAlgorithm
import com.sunmi.printerx.enums.PrinterInfo
import com.sunmi.printerx.enums.Rotate
import com.sunmi.printerx.enums.Shape
import com.sunmi.printerx.style.AreaStyle
import com.sunmi.printerx.style.BarcodeStyle
import com.sunmi.printerx.style.BaseStyle
import com.sunmi.printerx.style.BitmapStyle
import com.sunmi.printerx.style.QrStyle
import com.sunmi.printerx.style.TextStyle
import io.dcloud.uts.UTSArray
import io.dcloud.uts.UTSJSONObject
import java.io.File
import java.io.FileOutputStream
import com.sunmi.printerx.enums.RenderColor
import com.sunmi.printerx.enums.Symbology
import com.sunmi.printerx.enums.SettingItem


object PrinterNative {
	private var currentPrinter: PrinterSdk.Printer? = null

	fun initPrinter(callback: (UTSJSONObject) -> Unit) {
		PrinterSdk.getInstance().log(true, "")

		PrinterSdk.getInstance().getPrinter(
			AppGlobals.get(),
			object : PrinterSdk.PrinterListen {
				override fun onDefPrinter(printer: PrinterSdk.Printer?) {
					currentPrinter = printer

					val result: UTSJSONObject =
						if (printer != null) {
							object : UTSJSONObject() {
								var code = 0
								var msg = "init Success"
							}
						} else {
							object : UTSJSONObject() {
								var code = 1
								var msg = "No default printer"
							}
						}
					callback(result)
				}

				override fun onPrinters(printers: List<PrinterSdk.Printer?>?) {
				}
			},
		)
	}

	fun getPrinterInfo(): UTSJSONObject =
		currentPrinter?.let { printer ->
			try {
				val queryApi = printer.queryApi()
				object : UTSJSONObject() {
					var code = 1
					var msg = "Success"
					var id = printer.toString()
					var status = queryApi.getStatus().name
					var name = queryApi.getInfo(PrinterInfo.NAME)
					var type = queryApi.getInfo(PrinterInfo.TYPE)
					var paper = queryApi.getInfo(PrinterInfo.PAPER)
				}
			} catch (e: Exception) {
				object : UTSJSONObject() {
					var code = 0
					var msg = "Error getting printer info: ${e.message}"
				}
			}
		} ?: object : UTSJSONObject() {
			var code = 0
			var msg = "No printer available"
		}
		
	fun destroy(){
		PrinterSdk.getInstance().destroy()
	}

	fun log(enable: Boolean, str: String){
		PrinterSdk.getInstance().log(enable, str)
	}

    fun initLine(align: Int, width: Int, height: Int, renderColor: Int, posX: Int) {
        val style = BaseStyle.getStyle()
        when (align) {
            0 -> style.setAlign(Align.DEFAULT)
            1 -> style.setAlign(Align.LEFT)
            2 -> style.setAlign(Align.CENTER)
            3 -> style.setAlign(Align.RIGHT)
        }
        style.setWidth(width).setHeight(height).setPosX(posX).setRenderColor(RenderColor.BLACK)
        currentPrinter?.lineApi()?.initLine(style)
    }


	fun printText(
		text: String,
		align: Int,
		fontStyle: Int,
		textSize: Int = 24,
		textWidthRatio: Int = 0,
		textHeightRatio: Int = 0,
		textSpace: Int = 0 
	) {
		currentPrinter?.lineApi()?.let { api ->
			val style = TextStyle.getStyle()

			when (fontStyle) {
				0 -> {}
				1 -> style.enableBold(true)
				2 -> style.enableUnderline(true)
				3 -> style.enableStrikethrough(true)
				4 -> style.enableItalics(true)
				5 -> style.enableInvert(true)
				6 -> style.enableAntiColor(true)
			}

			when (align) {
				0 -> style.setAlign(Align.DEFAULT)
				1 -> style.setAlign(Align.LEFT)
				2 -> style.setAlign(Align.CENTER)
				3 -> style.setAlign(Align.RIGHT)
			}

			style.setTextWidthRatio(textWidthRatio)
			style.setTextHeightRatio(textHeightRatio)
			style.setTextSize(textSize)
			style.setTextSpace(textSpace)
			api.printText(text, style)
		}
	}

	/**
	 *  style:
	 *  0 默认
	 *  1 加粗
	 *  2 下划线
	 *  3 删除线
	 *  4 倾斜
	 */
	fun addText(
		text: String,
		align: Int,
		fontStyle: Int,
		textSize: Int = 24,
		textWidthRatio: Int = 0,
		textHeightRatio: Int = 0,
		textSpace: Int = 0 
	) {
		currentPrinter?.lineApi()?.let { api ->
			val style = TextStyle.getStyle()

			when (fontStyle) {
				0 -> {}
				1 -> style.enableBold(true)
				2 -> style.enableUnderline(true)
				3 -> style.enableStrikethrough(true)
				4 -> style.enableItalics(true)
				5 -> style.enableInvert(true)
				6 -> style.enableAntiColor(true)
			}

			when (align) {
				0 -> style.setAlign(Align.DEFAULT)
				1 -> style.setAlign(Align.LEFT)
				2 -> style.setAlign(Align.CENTER)
				3 -> style.setAlign(Align.RIGHT)
			}
			
			style.setTextWidthRatio(textWidthRatio)
			style.setTextHeightRatio(textHeightRatio)
			style.setTextSize(textSize)
			style.setTextSpace(textSpace)
			
			api.addText(text, style)
		}
	}

	fun printTexts(
		texts: UTSArray<String>,
		ints: UTSArray<Number>,
		fontStyles: UTSArray<Int>,
		aligns: UTSArray<Int>,
	) {
		val textStyles = mutableListOf<TextStyle>()
		fontStyles.forEachIndexed { index, fontStyle ->
			val align = aligns[index]
			val style = TextStyle.getStyle()
			when (fontStyle) {
				0 -> {}
				1 -> style.enableBold(true)
				2 -> style.enableUnderline(true)
				3 -> style.enableStrikethrough(true)
				4 -> style.enableItalics(true)
			}
			when (align) {
				0 -> style.setAlign(Align.DEFAULT)
				1 -> style.setAlign(Align.LEFT)
				2 -> style.setAlign(Align.CENTER)
				3 -> style.setAlign(Align.RIGHT)
			}
			textStyles.add(style)
		}

		val textArray = Array<String>(texts.length.toInt()) { i -> texts[i] }

		val intArray = IntArray(ints.length.toInt()) { i -> ints[i].toInt() }

		currentPrinter?.lineApi()?.printTexts(textArray, intArray, textStyles.toTypedArray())
	}

	fun printBarCode(
		text: String,
		align: Int,
		dotWidth: Int,
		barHeight: Int,
		readable: Int,
		barWidth: Int,
		symbology: Int,
	) {
		val barcodeStyle = BarcodeStyle.getStyle()
		when (align) {
			0 -> barcodeStyle.setAlign(Align.DEFAULT)
			1 -> barcodeStyle.setAlign(Align.LEFT)
			2 -> barcodeStyle.setAlign(Align.CENTER)
			3 -> barcodeStyle.setAlign(Align.RIGHT)
		}
		val symbologyEnum = Symbology.values().getOrNull(symbology) ?: Symbology.CODE128
		barcodeStyle
			.setDotWidth(dotWidth)
			.setBarHeight(barHeight)
			.setReadable(HumanReadable.POS_TWO)
			.setSymbology(symbologyEnum)

		if (barWidth > 0) barcodeStyle.setWidth(barWidth)
		currentPrinter?.lineApi()?.printBarCode(text, barcodeStyle)
	}

	fun printBitmap(
		base64: String,
		align: Int,
		width: Int,
		height: Int,
		posX: Int,
		posY: Int,
		algorithm: Int,
		value: Int
	) {
		var base64Data: String = base64
		if (base64Data.contains(",")) {
			base64Data = base64Data.substring(base64Data.indexOf(",") + 1)
		}
		val decodedBytes: ByteArray = Base64.decode(base64Data, Base64.DEFAULT)
		// 2. 将字节数组转换为 Bitmap
		val bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.size)

		if (bitmap == null) {
			Log.e("ericGe", "Bitmap 解码失败")
			return
		}

		val style = BitmapStyle.getStyle()
		when (align) {
			0 -> style.setAlign(Align.DEFAULT)
			1 -> style.setAlign(Align.LEFT)
			2 -> style.setAlign(Align.CENTER)
			3 -> style.setAlign(Align.RIGHT)
		}
		style
			.setWidth(width)
			.setHeight(height)
			.setPosX(posX)
			.setPosY(posY)
			.setValue(value)

		when (algorithm) {
			0 -> style.setAlgorithm(ImageAlgorithm.BINARIZATION)
			1 -> style.setAlgorithm(ImageAlgorithm.DITHERING)
		}
		currentPrinter?.lineApi()?.printBitmap(bitmap, style)
	}

	fun printQrCode(
		qrcode: String,
		align: Int,
		dot: Int = 4,
		width: Int = -1,
		height: Int = -1,
		errorLevel: Int = 0,
	) {
		val style = QrStyle.getStyle()
		when (align) {
			0 -> style.setAlign(Align.DEFAULT)
			1 -> style.setAlign(Align.LEFT)
			2 -> style.setAlign(Align.CENTER)
			3 -> style.setAlign(Align.RIGHT)
		}
		val level = when (errorLevel) {
			0 -> ErrorLevel.L
			1 -> ErrorLevel.M
			2 -> ErrorLevel.Q
			3 -> ErrorLevel.H
			else -> ErrorLevel.L
		}
		style
			.setDot(dot)
			.setWidth(width)
			.setHeight(height)
			.setErrorLevel(level)
		currentPrinter?.lineApi()?.printQrCode(qrcode, style)
	}

	/**
	 *  打印分割线
	 */
	fun printDividingLine(
		lineType: Int,
		lineHeight: Int = 10,
	) {
		val dividingLine =
			when (lineType) {
				0 -> DividingLine.EMPTY
				1 -> DividingLine.SOLID
				2 -> DividingLine.DOTTED
				else -> DividingLine.SOLID
			}
		currentPrinter?.lineApi()?.printDividingLine(dividingLine, lineHeight)
	}
	
	/**
	 *  是否开启事务模式
	 */
	fun enableTransMode(enable: Boolean){
		currentPrinter?.lineApi()?.enableTransMode(enable)
	}

	/**
	 *  打印结果回调
	 */
	fun printTrans(callback: (UTSJSONObject) -> Unit) {
		currentPrinter?.lineApi()?.printTrans(
			object : PrintResult() {
				override fun onResult(
					resultCode: Int,
					message: String,
				) {
					val result: UTSJSONObject =
						object : UTSJSONObject() {
							var code = resultCode
							var msg =
								if (resultCode == 0) {
									"print success: " + message
								} else {
									"print failed: " + message
								}
						}
					callback(result)
				}
			},
		)
	}

	/**
	 *  打印结束，自动退出
	 */
	fun autoOut() {
		currentPrinter?.lineApi()?.autoOut()
	}

	// --------------------- 标签打印 -------------------//
	fun initCanvasApi(
		align: Int,
		width: Int,
		height: Int,
		renderColor: Int,
		posX: Int,
	) {
		val style = BaseStyle.getStyle()
		when (align) {
			0 -> style.setAlign(Align.DEFAULT)
			1 -> style.setAlign(Align.LEFT)
			2 -> style.setAlign(Align.CENTER)
			3 -> style.setAlign(Align.RIGHT)
			else -> style.setAlign(Align.DEFAULT)
		}
		style.setWidth(width).setHeight(height).setPosX(posX)
		when (renderColor) {
			0 -> style.setRenderColor(RenderColor.BLACK)
			1 -> style.setRenderColor(RenderColor.RED)
			else -> style.setRenderColor(RenderColor.BLACK)
		}
		currentPrinter?.canvasApi()?.initCanvas(style)
	}

	fun renderArea(
		width: Int = 50,
		height: Int = 50,
		posX: Int,
		posY: Int,
		endX: Int = 50,
		endY: Int = 50,
		thick: Int = 1,
		shape: Int = 3,
	) {
		val shapeEnum = Shape.values().getOrNull(shape) ?: Shape.BOX
		val style = AreaStyle.getStyle()
		style
			.setStyle(shapeEnum)
			.setPosX(posX)
			.setPosY(posY)
			.setWidth(width)
			.setHeight(height)
			.setEndX(endX)
			.setEndY(endY)
			.setThick(thick)
		currentPrinter?.canvasApi()?.renderArea(style)
	}

	fun renderText(
		text: String,
		align: Int,
		fontStyle: Int,
		textSize: Int = 24,
		textWidthRatio: Int = 0,
		textHeightRatio: Int = 0,
		posX: Int,
		posY: Int,
		width: Int,
		height: Int,
		rotate: Int,
	) {
		val style = TextStyle.getStyle()
		when (fontStyle) {
			0 -> {}
			1 -> style.enableBold(true)
			2 -> style.enableUnderline(true)
			3 -> style.enableStrikethrough(true)
			4 -> style.enableItalics(true)
		}

		when (align) {
			0 -> style.setAlign(Align.DEFAULT)
			1 -> style.setAlign(Align.LEFT)
			2 -> style.setAlign(Align.CENTER)
			3 -> style.setAlign(Align.RIGHT)
		}
		
		when (rotate) {
			0 -> style.setRotate(Rotate.ROTATE_0)
			90 -> style.setRotate(Rotate.ROTATE_90)
			180 -> style.setRotate(Rotate.ROTATE_180)
			270 -> style.setRotate(Rotate.ROTATE_270)
		}

		style.setTextWidthRatio(textWidthRatio)
		style.setTextHeightRatio(textHeightRatio)
		style.setTextSize(textSize)
		style.setPosX(posX)
		style.setPosY(posY)
		style.setWidth(width)
		style.setHeight(height)

		currentPrinter?.canvasApi()?.renderText(text, style)
	}

	fun renderBarCode(
		text: String,
		align: Int = 0,
		dotWidth: Int = 2,
		barWidth: Int,
		barHeight: Int = 162,
		posX: Int = 0,
		posY: Int = 0,
		width: Int = -1,
		height: Int = -1,
		readable: Int,
	) {
		val barcodeStyle = BarcodeStyle.getStyle()
		when (align) {
			0 -> barcodeStyle.setAlign(Align.DEFAULT)
			1 -> barcodeStyle.setAlign(Align.LEFT)
			2 -> barcodeStyle.setAlign(Align.CENTER)
			3 -> barcodeStyle.setAlign(Align.RIGHT)
		}
		val readableEnum = HumanReadable.values().getOrNull(readable) ?: HumanReadable.POS_TWO
		barcodeStyle
			.setDotWidth(dotWidth)
			.setBarHeight(barHeight)
			.setPosX(posX)
			.setPosY(posY)
			.setWidth(width)
			.setHeight(height)
			.setReadable(readableEnum)
		currentPrinter?.canvasApi()?.renderBarCode(text, barcodeStyle)
	}

	fun renderBitmap(
		base64: String,
		posX: Int = 0,
		posY: Int = 0,
		width: Int = -1,
		height: Int = -1,
	) {
		var base64Data: String = base64
		if (base64Data.contains(",")) {
			base64Data = base64Data.substring(base64Data.indexOf(",") + 1)
		}
		val decodedBytes: ByteArray = Base64.decode(base64Data, Base64.DEFAULT)
		// 2. 将字节数组转换为 Bitmap
		val bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.size)

		// 调试bitmap start

		if (bitmap == null) {
			Log.e("ericGe", "Bitmap 解码失败")
			return
		}

		// 调试：保存 bitmap 到文件系统，用于检查
		// saveBitmapForDebug(bitmap, "original_bitmap.png")
		// 调试bitmap end

		val style = BitmapStyle.getStyle()
		style.setAlgorithm(ImageAlgorithm.DITHERING)

		style
			.setPosX(posX)
			.setPosY(posY)
			.setWidth(width)
			.setHeight(height)

		currentPrinter?.canvasApi()?.renderBitmap(bitmap, style)
	}

	// 保存 Bitmap 用于调试
	private fun saveBitmapForDebug(
		bitmap: Bitmap,
		filename: String,
	) {
		try {
			val context = AppGlobals.get() // 获取 Context
			val file = File(context.getExternalFilesDir(null), filename)
			val stream = FileOutputStream(file)
			bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
			stream.flush()
			stream.close()
			Log.d("ericGe", "Bitmap 已保存到: ${file.absolutePath}")
		} catch (e: Exception) {
			Log.e("ericGe", "保存 Bitmap 失败", e)
		}
	}

	fun renderQrCode(
		text: String,
		align: Int,
		posX: Int,
		posY: Int,
		width: Int,
		height: Int,
		dot: Int,
	) {
		val style = QrStyle.getStyle()
		when (align) {
			0 -> style.setAlign(Align.DEFAULT)
			1 -> style.setAlign(Align.LEFT)
			2 -> style.setAlign(Align.CENTER)
			3 -> style.setAlign(Align.RIGHT)
		}
		style
			.setPosX(posX)
			.setPosY(posY)
			.setWidth(width)
			.setHeight(height)
			.setDot(dot)
		currentPrinter?.canvasApi()?.renderQrCode(text, style)
	}

	fun sendEscCommand(array: ByteArray) {
		currentPrinter?.commandApi()?.sendEscCommand(array)
	}

	/**
	 * 接收 base64 字符串形式的 ESC 指令，在 native 层解码为字节后发送，避免 Vue 中 Byte 转换导致错别字。
	 */
	fun sendEscCommand(escCommandBase64: String) {
		val bytes = Base64.decode(escCommandBase64, Base64.DEFAULT)
		sendEscCommand(bytes)
	}


	fun sendTsplCommand(array: ByteArray) {
		currentPrinter?.commandApi()?.sendTsplCommand(array)
	}

	/**
	 * 接收字符串形式的 TSPL 指令，转为字节后发送。
	 */
	fun sendTsplCommand(tsplCommandStr: String) {
		val bytes = tsplCommandStr.toByteArray(Charsets.UTF_8)
		sendTsplCommand(bytes)
	}

	fun printCanvas(
		callback: (UTSJSONObject) -> Unit,
		count: Int,
	) {
		currentPrinter?.canvasApi()?.printCanvas(
			count,
			object : PrintResult() {
				override fun onResult(
					resultCode: Int,
					message: String?,
				) {
					val result: UTSJSONObject =
						object : UTSJSONObject() {
							var code = resultCode
							var msg = "printCanvas: $message"
						}
					callback(result)
				}
			},
		)
	}
	
	/**





	 *  打开钱箱（通过 open 参数中的回调返回成功或失败）
	 *  @param callback 异步回调，result.code 为 0 表示成功，非 0 表示失败；result.msg 为说明信息
	 */
	fun openCashDrawer(callback: (UTSJSONObject) -> Unit) {
		try {
			val api = currentPrinter?.cashDrawerApi() ?: run {
				callback(object : UTSJSONObject() {
					var code = 1
					var msg = "Cash drawer is not supported on this device"
				})
				return
			}
			api.open(object : PrintResult() {
				override fun onResult(resultCode: Int, message: String) {
					callback(object : UTSJSONObject() {
						var code = resultCode
						var msg = if (resultCode == 0) "Open success" else (message.ifEmpty { "Failed to open cash drawer" })
					})
				}
			})
		} catch (e: Exception) {
			val msg = when {
				e.message?.contains("Unsupported") == true -> "Cash drawer is not supported on this device"
				else -> (e.message ?: "Failed to open cash drawer")
			}
			callback(object : UTSJSONObject() {
				var code = 1
				var msg = msg
			})
		}
	}

	/**
	 *  钱箱是否打开（不支持钱箱的设备会抛出异常，需在调用方捕获并提示）
	 */
	fun isCashDrawerOpen(): Boolean {
		return try {
			currentPrinter?.cashDrawerApi()?.isOpen ?: false
		} catch (e: Exception) {
			if (e.message?.contains("Unsupported") == true) {
				throw RuntimeException("Cash drawer is not supported on this device", e)
			}
			throw e
		}
	}

	/**
	 * 打开打印设置页面
	 * @param settingItemOrdinal 对应 SettingItem 枚举的 ordinal，0 为默认设置页
	 * @return 是否成功调起设置页
	 */
	fun startSettings(settingItemOrdinal: Int): Boolean {
		return try {
			val activity = getCurrentActivity() ?: return false
			val item = SettingItem.values().getOrNull(settingItemOrdinal) ?: SettingItem.ALL
			PrinterSdk.getInstance().startSettings(activity, item)
		} catch (e: Exception) {
			Log.e("PrinterNative", "startSettings failed", e)
			false
		}
	}

	@SuppressLint("PrivateApi")
	private fun getCurrentActivity(): android.app.Activity? {
		return try {
			val activityThreadClass = Class.forName("android.app.ActivityThread")
			val currentActivityThread = activityThreadClass.getMethod("currentActivityThread").invoke(null)
			val mActivitiesField = activityThreadClass.getDeclaredField("mActivities")
			mActivitiesField.isAccessible = true
			val mActivities = mActivitiesField.get(currentActivityThread) as? Map<*, *> ?: return null
			for (activityRecord in mActivities.values) {
				val recordClass = activityRecord!!::class.java
				val pausedField = recordClass.getDeclaredField("paused")
				pausedField.isAccessible = true
				if (!(pausedField.get(activityRecord) as Boolean)) {
					val activityField = recordClass.getDeclaredField("activity")
					activityField.isAccessible = true
					return activityField.get(activityRecord) as? android.app.Activity
				}
			}
			null
		} catch (e: Exception) {
			Log.e("PrinterNative", "getCurrentActivity failed", e)
			null
		}
	}
}

object AppGlobals {
	private lateinit var application: Application

	@SuppressLint("PrivateApi")
	fun get(): Application {
		try {
			application =
				Class
					.forName("android.app.ActivityThread")
					.getMethod("currentApplication")
					.invoke(null) as Application
		} catch (ex: Exception) {
			ex.printStackTrace()
		}
		return application
	}
}
