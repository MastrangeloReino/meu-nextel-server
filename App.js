import {
  View,
  Text,
  Pressable,
  Button,
  Alert,
  PermissionsAndroid,
  Platform,
} from "react-native";
import { useState, useRef, useEffect } from "react";
import { Audio } from "expo-av";
import { io } from "socket.io-client";
import * as FileSystem from "expo-file-system/legacy";
import BackgroundService from "react-native-background-actions";

const SERVER_URL = "https://meu-nextel-server.onrender.com";

const socket = io(SERVER_URL, {
  autoConnect: false,
});

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));

const backgroundOptions = {
  taskName: "Mastrapp",
  taskTitle: "Mastrapp ativo",
  taskDesc: "Pronto para receber áudio",
  taskIcon: {
    name: "ic_launcher",
    type: "mipmap",
  },
  color: "#111111",
};

export default function App() {
  const [falando, setFalando] = useState(false);
  const [online, setOnline] = useState(false);
  const recording = useRef(null);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Conectado ao servidor:", socket.id);
    });

    socket.on("audio", async (data) => {
      try {
        console.log("Áudio recebido no app");

        const fileUri =
          FileSystem.documentDirectory + `audio-${Date.now()}.m4a`;

        await FileSystem.writeAsStringAsync(fileUri, data, {
          encoding: "base64",
        });

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
        await sound.playAsync();
      } catch (e) {
        console.log("Erro ao tocar áudio:", e);
      }
    });

    return () => {
      socket.off("connect");
      socket.off("audio");
    };
  }, []);

  const backgroundTask = async () => {
    console.log("Serviço background iniciado");

    if (!socket.connected) {
      socket.connect();
    }

    while (BackgroundService.isRunning()) {
      await sleep(1000);
    }
  };

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Permissão negada", "Permita o uso do microfone.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      recording.current = rec;
      setFalando(true);
    } catch (e) {
      console.log("Erro ao iniciar gravação:", e);
    }
  }

  async function stopRecording() {
    try {
      if (!recording.current) return;

      setFalando(false);

      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();

      if (!uri) {
        recording.current = null;
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });

      if (!socket.connected) {
        socket.connect();
      }

      socket.emit("audio", base64);
      console.log("Áudio enviado para o servidor");

      recording.current = null;
    } catch (e) {
      console.log("Erro ao parar/enviar áudio:", e);
      recording.current = null;
      setFalando(false);
    }
  }

  async function toggleOnline() {
    try {
      if (!online) {
        if (Platform.OS === "android" && Platform.Version >= 33) {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
        }

        await BackgroundService.start(backgroundTask, backgroundOptions);

        socket.connect();
        setOnline(true);
        console.log("Modo rádio ATIVO");
      } else {
        await BackgroundService.stop();

        socket.disconnect();
        setOnline(false);
        console.log("Modo rádio DESLIGADO");
      }
    } catch (e) {
      console.log("Erro no modo online:", e);
      Alert.alert("Erro", String(e));
    }
  }

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#111",
      }}
    >
      <Text style={{ color: "#fff", marginBottom: 20 }}>
        {falando ? "🎤 Gravando..." : online ? "📡 Online" : "🔇 Offline"}
      </Text>

      <Pressable
        onPressIn={startRecording}
        onPressOut={stopRecording}
        style={{
          backgroundColor: falando ? "red" : "#333",
          padding: 40,
          borderRadius: 100,
          marginBottom: 20,
        }}
      >
        <Text style={{ color: "#fff" }}>
          {falando ? "SOLTA PRA PARAR" : "SEGURA PRA FALAR"}
        </Text>
      </Pressable>

      <Button
        title={online ? "Ficar offline" : "Ficar online"}
        onPress={toggleOnline}
      />
    </View>
  );
}
