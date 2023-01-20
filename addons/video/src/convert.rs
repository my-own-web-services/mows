use std::process::Command;

pub async fn convert(source_path: &str, target_folder: &str, file_id: &str) -> anyhow::Result<()> {
    let video_quality = 30;
    let video_targets = vec![360];
    let threads = 4;

    let target_folder = if target_folder.ends_with("/") {
        format!("{target_folder}{file_id}/",)
    } else {
        format!("{target_folder}/{file_id}/")
    };

    std::fs::create_dir_all(format!("{target_folder}t"))?;

    let mut frames_command = Command::new("ffprobe");
    frames_command
        .arg("-v")
        .arg("error")
        .arg("-select_streams")
        .arg("v:0")
        .arg("-count_packets")
        .arg("-show_entries")
        .arg("stream=nb_read_packets")
        .arg("-of")
        .arg("csv=p=0")
        .arg(source_path);

    let output = frames_command.output()?.stdout;
    let frame_count_str = std::str::from_utf8(&output)?.trim();
    let frame_count: f64 = frame_count_str.parse()?;

    let mut video_length_command = Command::new("ffprobe");

    video_length_command
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(source_path);

    let output = video_length_command.output()?.stdout;
    let video_length_str = std::str::from_utf8(&output)?.trim();
    let video_length: f64 = video_length_str.parse()?;

    let mut video_command = Command::new("ffmpeg");

    video_command
        .arg("-hide_banner")
        .arg("-y")
        .arg("-i")
        .arg(source_path)
        .arg("-c:v")
        .arg("libsvtav1")
        .arg("-row-mt")
        .arg("1")
        .arg("-keyint_min")
        .arg("150")
        .arg("-g")
        .arg("150")
        .arg("-tile-columns")
        .arg("4")
        .arg("-frame-parallel")
        .arg("1")
        .arg("-dash")
        .arg("1")
        .arg("-f")
        .arg("webm")
        .arg("-threads")
        .arg(threads.to_string());

    for video_target in &video_targets {
        video_command
            .arg("-an")
            .arg("-vf")
            .arg(format!("scale=-1:{video_target}"))
            .arg("-b:v")
            .arg("0")
            .arg("-crf")
            .arg(video_quality.to_string())
            .arg("-dash")
            .arg("1")
            .arg(format!("{target_folder}{video_target}.webm"));
    }

    //video_command.spawn()?.wait()?;

    let mut audio_command = Command::new("ffmpeg");

    audio_command
        .arg("-hide_banner")
        .arg("-y")
        .arg("-i")
        .arg(source_path)
        .arg("-vn")
        .arg("-c:a")
        .arg("libopus")
        .arg("-b:a")
        .arg("128k")
        .arg("-f")
        .arg("webm")
        .arg("-dash")
        .arg("1")
        .arg(format!("{target_folder}audio.webm"));

    let audio_result = audio_command.spawn()?.wait();

    let mut manifest_command = Command::new("ffmpeg");

    manifest_command.arg("-hide_banner").arg("-y");

    let mut all_targets = 0;
    let mut video_adaption_sets = "".to_string();
    let mut audio_adaption_sets = "".to_string();

    for (i, video_target) in video_targets.iter().enumerate() {
        manifest_command
            .arg("-f")
            .arg("webm_dash_manifest")
            .arg("-i")
            .arg(format!("{target_folder}{video_target}.webm"));
        video_adaption_sets += format!("{},", i).as_str();
        all_targets += 1;
    }

    match audio_result {
        Ok(_) => {
            manifest_command
                .arg("-f")
                .arg("webm_dash_manifest")
                .arg("-i")
                .arg(format!("{target_folder}audio.webm"));
            audio_adaption_sets += format!("{},", video_targets.len()).as_str();

            all_targets += 1;
        }
        Err(_) => {}
    };

    manifest_command.arg("-c").arg("copy");

    for num in 0..all_targets {
        manifest_command.arg("-map").arg(num.to_string());
    }

    video_adaption_sets.pop();
    audio_adaption_sets.pop();

    let adaption_sets = match audio_result {
        Ok(_) => format!("id=0,streams={video_adaption_sets} id=1,streams={audio_adaption_sets}"),
        Err(_) => format!("id=0,streams={video_adaption_sets}"),
    };

    manifest_command
        .arg("-f")
        .arg("webm_dash_manifest")
        .arg("-adaptation_sets")
        .arg(adaption_sets)
        .arg(format!("{target_folder}manifest.mpd"));

    manifest_command.spawn()?.wait()?;

    let mut thumbnail_command = Command::new("ffmpeg");

    let thumbnail_count = 10.0;

    let a = video_length / thumbnail_count;

    thumbnail_command
        .arg("-hide_banner")
        .arg("-y")
        .arg("-i")
        .arg(source_path)
        .arg("-c:v")
        .arg("libwebp")
        .arg("-vf")
        .arg(format!("scale=-1:480,fps=1/{a}"))
        .arg(format!("{target_folder}t/%d.webp"));

    thumbnail_command.spawn()?.wait()?;

    Ok(())
}

/*
  // pack all files into an archive
    let file = File::create(format!("{target_folder}{file_id}.dash.tar"))?;
    let mut tar = tar::Builder::new(file);

    for video_target in &video_targets {
        let name = format!("{target_folder}{video_target}.webm");
        let mut file = File::open(&name)?;
        tar.append_file(format!("{video_target}.webm"), &mut file)?;
    }

    match audio_result {
        Ok(_) => {
            let name = format!("{target_folder}audio.webm");
            let mut file = File::open(&name)?;
            tar.append_file("audio.webm", &mut file)?;
        }
        Err(_) => {}
    };

    let name = format!("{target_folder}manifest.mpd");
    let mut file = File::open(&name)?;
    tar.append_file("manifest.mpd", &mut file)?;
    std::fs::remove_dir_all(temp_folder)?;

*/
