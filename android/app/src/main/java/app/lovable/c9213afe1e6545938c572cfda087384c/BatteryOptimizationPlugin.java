package app.lovable.c9213afe1e6545938c572cfda087384c;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

/**
 * Capacitor plugin for battery optimization management
 * Allows TypeScript/JavaScript code to check and request battery optimization exemption
 */
@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        boolean isIgnoring = BatteryOptimizationHelper.isIgnoringBatteryOptimizations(getContext());
        
        JSObject result = new JSObject();
        result.put("isIgnoring", isIgnoring);
        call.resolve(result);
    }

    @PluginMethod
    public void requestBatteryOptimizationExemption(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            BatteryOptimizationHelper.requestBatteryOptimizationExemption(getActivity());
            call.resolve();
        });
    }

    @PluginMethod
    public void isXiaomiDevice(PluginCall call) {
        boolean isXiaomi = BatteryOptimizationHelper.isXiaomiDevice();
        
        JSObject result = new JSObject();
        result.put("isXiaomi", isXiaomi);
        call.resolve(result);
    }

    @PluginMethod
    public void openAutostartSettings(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            BatteryOptimizationHelper.openAutostartSettings(getActivity());
            call.resolve();
        });
    }
}
